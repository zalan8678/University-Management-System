import fs from "fs/promises";
import express from "express";
import cors from "cors";
import path from "path";

/**
 * Express application.
 */
export type Application = ReturnType<typeof express>;

/**
 * Configuration options for the application.
 */
export type AppConfig = {
	/**
	 * The directory where application data will be stored enabling the application to persist data between restarts.
	 *
	 * @internal
	 * During autograding, the directory will be deleted as a means to reset the application data between tests.
	 */
	readonly datadir: string;
};

/**
 * Initializes the application.
 */
export async function createApp(config: AppConfig): Promise<Application> {
	const app = express();
	const multer = require("multer");
	const JSZip = require("jszip");
	const upload = multer({ storage: multer.memoryStorage() });
	let idCounter = 1;
	const datasets = new Map<string, Dataset>(); // where string is the DatasetID

	const { datadir } = config;

	// Ensure the data directory exists
	await fs.mkdir(datadir, { recursive: true });

	const model = await Model.readModel(datadir);

	// Make files in ../frontend/public accessible at http://localhost:<port>/
	app.use(express.static("frontend/public"));

	// Register middleware to parse request before passing them to request handlers
	// Note: JSON parser must be place before raw parser because of wildcard matching done by raw parser below
	app.use(express.json());
	app.use(express.raw({ type: "application/*", limit: "10mb" }));
	app.use(cors());

	// Basic message to verify REST API is available
	// You can see the message by going to http://localhost:<port>/api
	app.get("/api", (_req, res) => {
		res.send("App is running!");
	});

	// test series 12
	app.post("/api/v1/datasets", upload.single("archive"), async (req, res) => {
		// REQUEST VALIDATION
		const kind = req.body?.kind;
		const archive = req.file;

		const fields: Record<string, string> = {}; // format is ai generated (and modified)

		if (kind === undefined) {
			fields.kind = "required but missing";
		} else if (kind !== "course_offerings") {
			fields.kind = "expected to be course_offerings";
		}

		if (archive === undefined) {
			fields.archive = "required but missing";
		} else if (archive.buffer.length === 0 || !archive.buffer) {
			fields.archive = "expected non-empty file";
		}

		if (Object.keys(fields).length > 0) {
			res.status(422).send({
				error: "Validation failed",
				fields,
			});
			return;
		} // end of ai generated

		// DATASET CREATION

		const id = `upload_${idCounter++}`; // incs idcounter after

		const data: Dataset = {
			// this line is ai gen'd
			id,
			kind,
			status: "processing",
			stats: {
				files_total: 0,
				files_processed: 0,
				files_skipped: 0,
				courses_seen: 0,
				courses_added: 0,
				courses_modified: 0,
				sections_seen: 0,
				sections_added: 0,
				sections_modified: 0,
			},
			message: "Processing in progress",
		};

		datasets.set(id, data);

		// PROCESS DATASET

		if (archive) {
			processDataset(id, archive.buffer);
		}

		// TEMP STATUS: PROCESSING

		res.status(202).send({
			id: id,
			status: "processing",
			kind: "course_offerings",
			message: "Dataset accepted for processing",
		});
		return;
	});

	async function processDataset(id: string, buffer: Buffer) {
		let dataset = datasets.get(id);
		if (!dataset) {
			return;
		}

		const latestYearForCourse = new Map<string, number>(); // this line is ai gen

		// VALIDATION

		let zip;
		try {
			zip = await JSZip.loadAsync(buffer);
		} catch (err) {
			dataset.status = "failed";
			dataset.message = "Data is not in a valid zip format";
			return;
		}

		// CONTENT PROCESSING

		const files = Object.values(zip.files).filter(
			// start of ai gen
			(file: any) => !file.dir && file.name.startsWith("courses/") && file.name.endsWith(".json")
		) as any[]; // end of ai gen

		if (files.length === 0) {
			// length = 0 means no files in courses/
			dataset.status = "failed";
			dataset.message = "Missing root courses directory";
			return;
		}

		dataset.stats.files_total = files.length;

		for (const file of files) {
			const content = await file.async("string"); // reads as string

			let sections; // every "result" is a unique section (result is an array of sections)
			try {
				const parsed = JSON.parse(content); // parses
				if (!Array.isArray(parsed.result)) throw new Error(); // this line is ai generated
				sections = parsed.result;
				dataset.stats.files_processed++;
			} catch {
				dataset.stats.files_skipped++;
				continue;
			}

			for (const section of sections) {
				// PROCESS COURSES
				const courseID = `${section.Subject}${section.Course}`;

				dataset.stats.courses_seen++;
				try {
					validateCourseInput(
						courseID, // id
						section.Title, // title
						section.Subject, // dept
						section.Course // code
					);

					const currCourse = model.getCourseById(courseID);

					if (!currCourse) {
						// course does not exist - ADD
						await model.setCourse(
							courseID, // id
							section.Title, // title TODO: MAKE MOST RECENT
							section.Subject, // dept
							section.Course // code
						);
						dataset.stats.courses_added++;
					} else if (
						currCourse.title !== section.Title || // course already exists - UPDATE
						currCourse.dept !== section.Subject ||
						currCourse.code !== section.Course
					) {
						let thisYear;
						if (section.Section === "overall") {
							thisYear = 1900;
						} else {
							thisYear = Number(section.Year);
						}

						let prevUploadYear = latestYearForCourse.get(courseID);
						if (prevUploadYear === undefined) {
							prevUploadYear = -Infinity;
						}

						let existingYear = getLatestYearforCourse(courseID);

						let newestKnownYear = prevUploadYear;
						if (existingYear > newestKnownYear) {
							newestKnownYear = existingYear;
						}

						if (thisYear > newestKnownYear) {
							latestYearForCourse.set(courseID, thisYear);
							await model.setCourse(
								courseID, // id
								section.Title, // OVERRIDE TITLE (THIS YEAR IS MORE RECENT)
								section.Subject, // dept
								section.Course // code
							);
						} else {
							await model.setCourse(
								courseID, // id
								currCourse.title, // OLD TITLE
								section.Subject, // dept
								section.Course // code
							);
						}

						dataset.stats.courses_modified++;
					} // ELSE: course exists and is updated - NO CHANGE
				} catch (err) {
					// if input invalid, goes to next file
					continue;
				}

				// PROCESS SECTIONS
				dataset.stats.sections_seen++;
				try {
					const currSection = await model.getSectionById(section.id);

					let actualYear;
					if (section.Section === "overall") {
						actualYear = 1900;
					} else {
						actualYear = Number(section.Year);
					}

					validateSectionInput(
						courseID, // courseid
						String(section.id), // id
						section.Professor, // instructor
						Number(actualYear), // year
						Number(section.Avg), // avg
						Number(section.Pass), // pass
						Number(section.Fail), // fail
						Number(section.Audit) // audit
					);

					if (!currSection) {
						// section does not exist - ADD
						await model.setSection(
							courseID, // courseid
							String(section.id), // id
							section.Professor, // instructor
							Number(actualYear), // year
							Number(section.Avg), // avg
							Number(section.Pass), // pass
							Number(section.Fail), // fail
							Number(section.Audit) // audit
						);
						dataset.stats.sections_added++;
					} else if (
						// section already exists - UPDATE
						currSection.instructor !== section.Professor ||
						currSection.year !== actualYear ||
						currSection.avg !== Number(section.Avg) ||
						currSection.pass !== Number(section.Pass) ||
						currSection.fail !== Number(section.Fail) ||
						currSection.audit !== Number(section.Audit)
					) {
						await model.setSection(
							courseID, // courseid
							String(section.id), // id
							section.Professor, // instructor
							actualYear, // year
							Number(section.Avg), // avg
							Number(section.Pass), // pass
							Number(section.Fail), // fail
							Number(section.Audit) // audit
						);
						dataset.stats.sections_modified++;
					} // ELSE: section exists and is updated - NO CHANGE
				} catch (err) {
					continue;
				}
			}
		}

		dataset.status = "completed";
		dataset.message = "Dataset processing complete";
	}

	// -- HELPER FUNCTIONS FOR POST DATASETS --

	function getLatestYearforCourse(courseId: string): number {
		const sections = model.getSections().filter((section) => section.courseId === courseId); // this line is ai generated

		if (sections.length === 0) return -Infinity;

		let maxYear = 0;

		for (const section of sections) {
			if (section.year > maxYear) {
				maxYear = section.year;
			}
		}

		return maxYear;
	}

	function validateCourseInput(id: string, title: string, dept: string, code: string) {
		if (title === undefined) {
			throw new Error();
		} else if (typeof title !== "string") {
			throw new Error();
		}

		if (dept === undefined) {
			throw new Error();
		} else if (typeof dept !== "string") {
			throw new Error();
		}
		if (code === undefined) {
			throw new Error();
		} else if (typeof code !== "string") {
			throw new Error();
		}
	}

	function validateSectionInput(
		courseId: string,
		id: string,
		instructor: string,
		year: number,
		avg: number,
		pass: number,
		fail: number,
		audit: number
	) {
		if (instructor === undefined) {
			throw new Error();
		} else if (typeof instructor !== "string") {
			throw new Error();
		}

		if (year === undefined) {
			throw new Error();
		} else if (typeof year !== "number" || year < 1900 || year > 2099) {
			throw new Error();
		}

		if (avg === undefined) {
			throw new Error();
		} else if (typeof avg !== "number" || avg < 0 || avg > 100) {
			throw new Error();
		}

		if (pass === undefined) {
			throw new Error();
		} else if (typeof pass !== "number" || pass < 0) {
			throw new Error();
		}

		if (fail === undefined) {
			throw new Error();
		} else if (typeof fail !== "number" || fail < 0) {
			throw new Error();
		}

		if (audit === undefined) {
			throw new Error();
		} else if (typeof audit !== "number" || audit < 0) {
			throw new Error();
		}
	}

	// -- END HELPER FUNCTIONS FOR POST DATASET --
	// test series 13
	app.get("/api/v1/datasets/:id", (req, res) => {
		const dataset = datasets.get(req.params.id);

		if (!dataset) {
			// validation
			res.status(404).send({
				error: "Not found",
				message: `no dataset with id '${req.params.id}'`,
			});
			return;
		}

		res.status(200).send(dataset); // else: send result
	});

	// 5
	app.get("/api/v1/courses", (req, res) => {
		// get courses
		const limit = parseInt(req.query.limit as string) || 100; // default 100
		const offset = parseInt(req.query.offset as string) || 0; // default 0
		if (offset < 0 || limit < 0 || limit > 5000) {
			// Genereated by AI
			let params: Record<string, string> = {};

			if (limit < 1 || limit > 5000) {
				params.limit = "expected an integer between 1 and 5000";
			}
			if (offset < 0) {
				params.offset = "expected an integer >= 0";
			}
			// End of AI code
			res.status(400).send({
				error: "Invalid request parameters",
				params,
			});
			return;
		}
		// Generated by AI
		const courses = model
			.getCourses()
			.slice()
			.sort((a, b) => a.id.localeCompare(b.id));
		// End of AI Code
		const paginatedResults = courses.slice(offset, offset + limit);
		const courseResults = paginatedResults.map((course) => {
			return {
				id: course.id,
				title: course.title,
				dept: course.dept,
				code: course.code,
				links: {
					self: `/api/v1/courses/${course.id}`,
					sections: `/api/v1/courses/${course.id}/sections`,
				},
			};
		});
		const body = {
			total: courses.length,
			limit: limit,
			offset: offset,
			items: courseResults,
		};
		res.status(200).send(body);
	});

	// 6
	app.get("/api/v1/courses/:courseId", (req, res) => {
		// get course
		const course = model.getCourseById(req.params.courseId);
		console.log(course);
		if (!course) {
			res.status(404).send({
				error: "Not found",
				message: `no course with id '${req.params.courseId}'`,
			});
			return;
		}

		// response
		res.status(200).send({
			id: course.id,
			title: course.title,
			dept: course.dept,
			code: course.code,
			links: {
				self: `/api/v1/courses/${course.id}`,
				sections: `/api/v1/courses/${course.id}/sections`,
			},
		});
	});

	// 7
	app.put("/api/v1/courses/:courseId", async (req, res) => {
		const title = req.body?.title;
		const dept = req.body?.dept;
		const code = req.body?.code;

		const fields: Record<string, string> = {}; // start of ai generated

		if (title === undefined) {
			fields.title = "required but missing";
		} else if (typeof title !== "string") {
			fields.title = "expected a string";
		}

		if (dept === undefined) {
			fields.dept = "required but missing";
		} else if (typeof dept !== "string") {
			fields.dept = "expected a string";
		}
		if (code === undefined) {
			fields.code = "required but missing";
		} else if (typeof code !== "string") {
			fields.code = "expected a string";
		}

		if (Object.keys(fields).length > 0) {
			res.status(422).send({
				error: "Validation failed",
				fields,
			});
			return;
		} // end of ai generated

		// get course
		const course = model.getCourseById(req.params.courseId);
		const newCourse = await model.setCourse(req.params.courseId, req.body.title, req.body.dept, req.body.code);

		if (!course) {
			// does not exist OR be part of correct parent org
			res.status(201).send({
				id: newCourse.id,
				title: newCourse.title,
				dept: newCourse.dept,
				code: newCourse.code,
				links: {
					self: req.originalUrl,
					sections: `/api/v1/courses/${req.params.courseId}/sections`,
				},
			});
		} else {
			res.sendStatus(204); // overwrite
		}
	});

	// 8
	app.delete("/api/v1/courses/:courseId", async (req, res) => {
		// get course
		const course = model.getCourseById(req.params.courseId);
		if (!course) {
			res.status(404).send({
				error: "Not found",
				message: `no course with id '${req.params.courseId}'`,
			});
			return;
		}

		// delete
		await model.delCourse(req.params.courseId); // also handles parents
		res.status(200).send({
			id: course.id,
			title: course.title,
			dept: course.dept,
			code: course.code,
			sections: course.sectionIds.length,
		});
	});

	// 9
	app.get("/api/v1/courses/:courseId/sections", (req, res) => {
		// get course
		const course = model.getCourseById(req.params.courseId);
		if (!course) {
			res.status(404).send({
				error: "Not found",
				message: `no course with id '${req.params.courseId}'`,
			});
			return;
		}
		const limit = parseInt(req.query.limit as string) || 100; // default 100
		const offset = parseInt(req.query.offset as string) || 0; // default 0
		if (offset < 0 || limit < 0 || limit > 5000) {
			res.status(400).send({
				error: "Invalid request parameters",
				params: { limit: "expected an integer between 1 and 5000", offset: "expected an integer >= 0" },
			});
			return;
		}
		// get sections
		// Generated by AI
		const sections = model
			.getSections()
			.filter((s) => s.courseId === req.params.courseId)
			.sort((a, b) => a.id.localeCompare(b.id));
		// End of AI Code
		const paginatedResults = sections.slice(offset, offset + limit);
		const sectionResults = paginatedResults.map((section) => {
			return {
				id: section.id,
				instructor: section.instructor,
				year: section.year,
				avg: section.avg,
				pass: section.pass,
				fail: section.fail,
				audit: section.audit,
				links: {
					self: `/api/v1/courses/${req.params.courseId}/sections/${section.id}`,
					course: `/api/v1/courses/${req.params.courseId}`,
				},
			};
		});
		const body = {
			total: sections.length,
			limit: limit,
			offset: offset,
			items: sectionResults,
		};
		res.status(200).send(body);
	});

	// 10
	app.get("/api/v1/orgs/:orgId/courses/:courseId/sections/:sectionId", (req, res) => {
		// get course
		const course = model.getCourseById(req.params.courseId);
		if (!course) {
			res.status(404).send({
				error: "Not found",
				message: `no course with id '${req.params.courseId}'`,
			});
			return;
		}

		// get section
		const section = model.getSectionById(req.params.sectionId);
		if (!section || section.courseId != req.params.courseId) {
			res.status(404).send({
				error: "Not found",
				message: `no section with id '${req.params.sectionId}'`,
			});
			return;
		}

		// response
		res.status(200).send({
			id: section.id,
			instructor: section.instructor,
			year: section.year,
			avg: section.avg,
			pass: section.pass,
			fail: section.fail,
			audit: section.audit,
			links: {
				self: req.originalUrl,
				course: `/api/v1/orgs/${req.params.orgId}/courses/${req.params.courseId}`,
			},
		});
	});

	// 11
	app.put("/api/v1/courses/:courseId/sections/:sectionId", async (req, res) => {
		const instructor = req.body?.instructor;
		const year = req.body?.year;
		const avg = req.body?.avg;
		const pass = req.body?.pass;
		const fail = req.body?.fail;
		const audit = req.body?.audit;

		const fields: Record<string, string> = {}; // start of ai generated (albeit modified)

		if (instructor === undefined) {
			fields.instructor = "required but missing";
		} else if (typeof instructor !== "string") {
			fields.instructor = "expected a string";
		}

		if (year === undefined) {
			fields.year = "required but missing";
		} else if (typeof year !== "number" || year < 1900 || year > 2099) {
			fields.year = "expected a number between 1900 and 2099";
		}

		if (avg === undefined) {
			fields.avg = "required but missing";
		} else if (typeof avg !== "number" || avg < 0 || avg > 100) {
			fields.avg = "expected a number between 0 and 100";
		}

		if (pass === undefined) {
			fields.pass = "required but missing";
		} else if (typeof pass !== "number" || pass < 0) {
			fields.pass = "expected a number >= 0";
		}

		if (fail === undefined) {
			fields.fail = "required but missing";
		} else if (typeof fail !== "number" || fail < 0) {
			fields.fail = "expected a number >= 0";
		}

		if (audit === undefined) {
			fields.audit = "required but missing";
		} else if (typeof audit !== "number" || audit < 0) {
			fields.audit = "expected a number >= 0";
		}

		if (Object.keys(fields).length > 0) {
			res.status(422).send({
				error: "Validation failed",
				fields,
			});
			return;
		} // end of ai generated

		// get course
		const course = model.getCourseById(req.params.courseId);
		if (!course) {
			res.status(404).send({
				error: "Not found",
				message: `no course with id '${req.params.courseId}'`,
			});
			return;
		}

		const section = model.getSectionById(req.params.sectionId);
		const newSection = await model.setSection(
			req.params.courseId,
			req.params.sectionId,
			req.body.instructor,
			req.body.year,
			req.body.avg,
			req.body.pass,
			req.body.fail,
			req.body.audit
		);

		if (!(section && section.courseId === req.params.courseId)) {
			// add
			res.status(201).send({
				id: newSection.id,
				instructor: newSection.instructor,
				year: newSection.year,
				avg: newSection.avg,
				pass: newSection.pass,
				fail: newSection.fail,
				audit: newSection.audit,
				links: {
					self: req.originalUrl,
					course: `/api/v1/courses/${req.params.courseId}`,
				},
			});
		} else {
			// overwrite
			res.sendStatus(204);
		}
	});

	// 12
	app.delete("/api/v1/courses/:courseId/sections/:sectionId", async (req, res) => {
		// get course
		const course = model.getCourseById(req.params.courseId);
		if (!course) {
			res.status(404).send({
				error: "Not found",
				message: `no course with id '${req.params.courseId}'`,
			});
			return;
		}

		// get section
		const section = model.getSectionById(req.params.sectionId);
		if (!section || section.courseId != req.params.courseId) {
			res.status(404).send({
				error: "Not found",
				message: `no section with id '${req.params.sectionId}'`,
			});
			return;
		}

		// delete
		await model.delSection(req.params.sectionId); // also handles parents
		res.status(200).send({
			id: section.id,
			instructor: section.instructor,
			year: section.year,
			avg: section.avg,
			pass: section.pass,
			fail: section.fail,
			audit: section.audit,
		});
	});

	return app;
}

type Data = {
	courses: Course[];
	sections: Section[];
};

class Model {
	private filepath: string; // start of genai (6 lines)
	private data: Data;

	private constructor(filepath: string, data: Data) {
		this.filepath = filepath;
		this.data = data;
	} // end of genai

	// --- LOAD AND SAVE ---

	static async readModel(datadir: string): Promise<Model> {
		const filepath = path.join(datadir, "model.json");

		try {
			const raw = await fs.readFile(filepath, "utf-8");
			const parsed = JSON.parse(raw) as Data; // ai generated (6 lines)
			const data: Data = {
				courses: Array.isArray(parsed.courses) ? parsed.courses : [],
				sections: Array.isArray(parsed.sections) ? parsed.sections : [],
			}; // end of ai generated
			return new Model(filepath, data);
		} catch {
			return new Model(filepath, { courses: [], sections: [] }); // file does not exist, create blank file?
		}
	}

	async writeModel(): Promise<void> {
		const dir = path.dirname(this.filepath);
		await fs.mkdir(dir, { recursive: true });
		await fs.writeFile(this.filepath, JSON.stringify(this.data, null, 2), "utf-8");
	}

	// --- COURSE METHODS ---

	public getCourses(): Course[] {
		return this.data.courses;
	}

	public getCourseById(id: string): Course | undefined {
		return this.data.courses.find((course) => course.id === id);
	}

	public async setCourse(id: string, title: string, dept: string, code: string): Promise<Course> {
		let course = this.getCourseById(id);
		if (course) {
			course.title = title;
			course.dept = dept;
			course.code = code;
		} else {
			course = { id, title, dept, code, sectionIds: [] };
			this.data.courses.push(course);
		}
		await this.writeModel();
		return course;
	}

	public async delCourse(id: string): Promise<void> {
		// assumes org exists
		const courseIndex = this.data.courses.findIndex((course) => course.id === id);

		if (courseIndex == -1) {
			return;
		}

		// delete associated sections
		const course = this.getCourseById(id);
		const sectionIds = course?.sectionIds; // course cannot be undefined
		if (sectionIds) {
			for (const sectionId of sectionIds) {
				await this.delSection(sectionId);
			}
		}

		this.data.courses.splice(courseIndex, 1); // delete course

		await this.writeModel();
		return;
	}

	// --- SECTION METHODS ---

	public getSections(): Section[] {
		return this.data.sections;
	}

	public getSectionById(id: string): Section | undefined {
		return this.data.sections.find((section) => section.id === id);
	}

	public async setSection(
		courseId: string,
		id: string,
		instructor: string,
		year: number,
		avg: number,
		pass: number,
		fail: number,
		audit: number
	): Promise<Section> {
		let section = this.getSectionById(id);
		if (section) {
			// overwrite
			section.instructor = instructor;
			section.year = year;
			section.avg = avg;
			section.pass = pass;
			section.fail = fail;
			section.audit = audit;
			section.courseId = courseId;
		} else {
			section = { id, instructor, year, avg, pass, fail, audit, courseId };
			this.data.sections.push(section);

			const course = this.getCourseById(courseId);
			if (course && !course.sectionIds.includes(id)) {
				course.sectionIds.push(id);
			}
		}
		await this.writeModel();
		return section;
	}

	public async delSection(id: string): Promise<void> {
		// assumes org exists
		const sectionIndex = this.data.sections.findIndex((section) => section.id === id);

		if (sectionIndex == -1) {
			return;
		}

		const courseid = this.getSectionById(id)?.courseId as string; // save id, prevent undefined

		this.data.sections.splice(sectionIndex, 1); // delete section

		// delete from parent
		const course = this.getCourseById(courseid);
		if (course && course.sectionIds.includes(id)) {
			const parentIndex = course.sectionIds.findIndex((sectionId) => sectionId === id);
			if (parentIndex !== -1) {
				course.sectionIds.splice(parentIndex, 1);
			}
		}

		await this.writeModel();
		return;
	}
}

export interface Course {
	id: string;
	title: string;
	dept: string;
	code: string;
	sectionIds: string[];
}

export interface Section {
	id: string;
	instructor: string;
	year: number;
	avg: number;
	pass: number;
	fail: number;
	audit: number;
	courseId: string;
}

export interface Dataset {
	id: string;
	status: "processing" | "completed" | "failed";
	kind: string;
	stats: {
		files_total: number;
		files_processed: number;
		files_skipped: number;
		courses_seen: number;
		courses_added: number;
		courses_modified: number;
		sections_seen: number;
		sections_added: number;
		sections_modified: number;
	};
	message: string;
}
