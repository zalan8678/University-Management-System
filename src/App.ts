import fs from "fs/promises";
import express from "express";
import cors from "cors";
import path from "path";

/**
 * Express application.
 */
export type Application = ReturnType<typeof express>;
const mfields = ["avg", "pass", "fail", "audit", "year"];
const sfields = ["title", "dept", "code", "instructor"];
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

		res.status(202).send({
			id: id,
			status: "processing",
			kind: "course_offerings",
			message: "Dataset accepted for processing",
		});

		if (archive) {
			await processDataset(id, archive.buffer);
		}

		// TEMP STATUS: PROCESSING
		return;
	});

	async function processDataset(id: string, buffer: Buffer) {
		let dataset = datasets.get(id);
		if (!dataset) {
			return;
		}

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
			(file: any) => !file.dir && file.name.startsWith("courses/")
		) as any[]; // end of ai gen

		if (files.length === 0) {
			// length = 0 means no files in courses/
			dataset.status = "failed";
			dataset.message = "Missing root courses directory";
			return;
		}

		dataset.stats.files_total = files.length;

		const content = await Promise.all(files.map((file) => file.async("string"))); // reads as string, ai gen'd line

		const seenCourses = new Map();
		const seenSections = new Map();

		for (const file of content) {
			let sections; // every "result" is a unique section (result is an array of sections)

			try {
				const parsed = JSON.parse(file); // parses
				if (!Array.isArray(parsed.result)) throw new Error(); // this line is ai generated
				sections = parsed.result;
				dataset.stats.files_processed++;
			} catch {
				dataset.stats.files_skipped++;
				continue; // skip files that are not valid json
			}

			for (const section of sections) {
				// PROCESS COURSES
				const courseID = `${section.Subject}${section.Course}`;

				const modelCourse = model.getCourseById(courseID); // the course in the MODEL
				const mapCourse = seenCourses.get(courseID); // the course in the MAP

				let latestYear = -Infinity;
				if (mapCourse) {
					latestYear = mapCourse.latestYear;
				} else if (modelCourse) {
					latestYear = modelCourse.latestYear;
				}

				let actualYear;
				if (section.Year === "overall") {
					actualYear = 1900;
				} else {
					actualYear = Number(section.Year);
				}

				try {
					validateCourseInput(
						courseID, // id
						section.Title, // title
						section.Subject, // dept
						section.Course // code
					);

					if (!modelCourse && !mapCourse) {
						// course does not exist AND is not being PROCESSED - ADD

						model.setCourse(courseID, section.Title, section.Subject, section.Course);

						const newCourse = model.getCourseById(courseID);
						if (newCourse && actualYear > latestYear) {
							newCourse.latestYear = actualYear;
						} // sets latest year to year of this section
						seenCourses.set(courseID, newCourse); // add to map
						dataset.stats.courses_seen++;
						dataset.stats.courses_added++;
					} else if (
						mapCourse &&
						((mapCourse.title !== section.Title && actualYear > latestYear) ||
							mapCourse.dept !== section.Subject ||
							mapCourse.code !== section.Course)
					) {
						// Course is in MAP and is DIFFERENT from MAP

						model.setCourse(courseID, section.Title, section.Subject, section.Course);

						const newCourse = model.getCourseById(courseID);
						if (newCourse && actualYear > latestYear) {
							newCourse.latestYear = actualYear;
						} // sets latest year to year of this section
						seenCourses.set(courseID, newCourse); // add to map
					} else if (
						!mapCourse &&
						modelCourse &&
						((modelCourse.title !== section.Title && actualYear > latestYear) ||
							modelCourse.dept !== section.Subject ||
							modelCourse.code !== section.Course)
					) {
						// course is NOT in MAP, exists in MODEL and is DIFFERENT from MODEL

						model.setCourse(courseID, section.Title, section.Subject, section.Course);

						const newCourse = model.getCourseById(courseID);
						if (newCourse && actualYear > latestYear) {
							newCourse.latestYear = actualYear;
						} // sets latest year to year of this section
						seenCourses.set(courseID, newCourse); // add to map
						dataset.stats.courses_seen++;
						dataset.stats.courses_modified++;
					} else if (!mapCourse && modelCourse && modelCourse.title === section.Title) {
						// assumed: not different from model
						const newCourse = model.getCourseById(courseID);
						seenCourses.set(courseID, newCourse); // add to map
						dataset.stats.courses_seen++;
					} // ELSE: course exists in MAP and is updated - NO CHANGE
				} catch (err) {
					// if input invalid, goes to next file
					continue;
				}

				// PROCESS SECTIONS
				const sectionID = String(section.id);
				const mapID = `${courseID}${sectionID}`;
				const modelSection = model.getSectionById(sectionID, courseID);
				const mapSection = seenSections.get(mapID);

				try {
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

					if (!mapSection && !modelSection) {
						// model does not exist AND is not being PROCESSED - ADD

						model.setSection(
							courseID, // courseid
							String(section.id), // id
							section.Professor, // instructor
							Number(actualYear), // year
							Number(section.Avg), // avg
							Number(section.Pass), // pass
							Number(section.Fail), // fail
							Number(section.Audit) // audit
						);

						const newSection = model.getSectionById(sectionID, courseID);
						seenSections.set(mapID, newSection);
						dataset.stats.sections_seen++;
						dataset.stats.sections_added++;
					} else if (
						mapSection &&
						(mapSection.instructor !== section.Professor ||
							mapSection.year !== actualYear ||
							Number(mapSection.avg) !== Number(section.Avg) ||
							Number(mapSection.pass) !== Number(section.Pass) ||
							Number(mapSection.fail) !== Number(section.Fail) ||
							Number(mapSection.audit) !== Number(section.Audit))
					) {
						// Section is in MAP and is DIFFERENT from MAP

						model.setSection(
							courseID, // courseid
							String(section.id), // id
							section.Professor, // instructor
							Number(actualYear), // year
							Number(section.Avg), // avg
							Number(section.Pass), // pass
							Number(section.Fail), // fail
							Number(section.Audit) // audit
						);

						const newSection = model.getSectionById(sectionID, courseID);
						seenSections.set(mapID, newSection);
					} else if (
						!mapSection &&
						modelSection &&
						(modelSection.instructor !== section.Professor ||
							modelSection.year !== actualYear ||
							Number(modelSection.avg) !== Number(section.Avg) ||
							Number(modelSection.pass) !== Number(section.Pass) ||
							Number(modelSection.fail) !== Number(section.Fail) ||
							Number(modelSection.audit) !== Number(section.Audit))
					) {
						// course is NOT in MAP, exists in MODEL and is DIFFERENT from MODEL

						model.setSection(
							courseID, // courseid
							String(section.id), // id
							section.Professor, // instructor
							Number(actualYear), // year
							Number(section.Avg), // avg
							Number(section.Pass), // pass
							Number(section.Fail), // fail
							Number(section.Audit) // audit
						);

						const newSection = model.getSectionById(sectionID, courseID);
						seenSections.set(mapID, newSection);
						dataset.stats.sections_seen++;
						dataset.stats.sections_modified++;
					} else if (!mapSection && modelSection) {
						const newSection = model.getSectionById(sectionID, courseID);
						seenSections.set(mapID, newSection);
						dataset.stats.sections_seen++;
					}
				} catch (err) {
					continue;
				}
			}
		}

		try {
			await model.writeModel();

			dataset.status = "completed";
			dataset.message = "Dataset processing complete";
		} catch {
			// for testing
		}
	}

	// -- HELPER FUNCTIONS FOR POST DATASETS --

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
		if (offset < 0 || limit < 1 || limit > 5000) {
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

		await model.writeModel();
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
		if (offset < 0 || limit < 1 || limit > 5000) {
			res.status(400).send({
				error: "Invalid request parameters",
				params: { limit: "expected an integer between 1 and 5000", offset: "expected an integer >= 0" },
			});
			return;
		}
		// get sections
		// Generated by AI
		const sections = (req.params.courseId ? (model.getCourseById(req.params.courseId)?.sectionIds ?? []) : [])
			.map((sid) => model.getSectionById(sid, req.params.courseId)!)
			.filter(Boolean)
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
	app.get("/api/v1/courses/:courseId/sections/:sectionId", (req, res) => {
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
		const section = model.getSectionById(req.params.sectionId, req.params.courseId);
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
				course: `/api/v1/courses/${req.params.courseId}`,
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

		const section = model.getSectionById(req.params.sectionId, req.params.courseId);
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

		await model.writeModel();
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
		const section = model.getSectionById(req.params.sectionId, req.params.courseId);
		if (!section || section.courseId != req.params.courseId) {
			res.status(404).send({
				error: "Not found",
				message: `no section with id '${req.params.sectionId}'`,
			});
			return;
		}

		// delete
		await model.delSection(req.params.sectionId, req.params.courseId); // also handles parents
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

	// Start of AI Code
	app.post("/api/v1/search", async (req, res) => {
		const { kind, query } = req.body ?? {};

		// ---------------- VALIDATION ----------------

		// Top-level validation
		const fields: Record<string, string> = {};

		if (kind === undefined) {
			fields.kind = "required but missing";
		} else if (kind !== "course_offerings") {
			fields.kind = "expected to be course_offerings";
		}

		if (query === undefined) {
			fields.query = "required but missing";
		} else if (typeof query !== "object" || query === null) {
			fields.query = "expected an object";
		}

		if (Object.keys(fields).length > 0) {
			res.status(422).send({
				error: "Validation failed",
				fields,
			});
			return;
		}

		try {
			validateQuery(query);

			const results = executeQuery(query);

			if (results.length > 5000) {
				res.status(413).send({
					error: "Too many results",
					message: "Query would return more than 5000 results",
					limit: 5000,
				});
				return;
			}

			res.status(200).send(results);
			return;
		} catch (err: any) {
			res.status(400).send({
				error: "Invalid query",
				message: err.message,
			});
			return;
		}
	});
	function validateMComparison(type: string, obj: any) {
		const keys = Object.keys(obj);
		if (keys.length !== 1 || !mfields.includes(keys[0]) || typeof obj[keys[0]] !== "number") {
			throw new Error(`${type} must be an object with one mfield of type number`);
		}
	}
	function validateQuery(query: any) {
		if (!query.WHERE) {
			throw new Error("Missing WHERE");
		}
		if (!query.OPTIONS) {
			throw new Error("Missing OPTIONS");
		}

		if (typeof query.WHERE !== "object") {
			throw new Error("WHERE must be an object with at most one FILTER");
		}

		validateFilter(query.WHERE);

		validateOptions(query.OPTIONS);
	}
	function validateOptions(options: any) {
		if (typeof options !== "object" || !options.COLUMNS) {
			throw new Error("Missing COLUMNS");
		}

		if (!Array.isArray(options.COLUMNS) || options.COLUMNS.length === 0) {
			throw new Error("Missing COLUMNS");
		}

		for (const key of options.COLUMNS) {
			if (![...mfields, ...sfields].includes(key)) {
				throw new Error("Unknown key in COLUMNS");
			}
		}

		if (options.ORDER) {
			if (!options.COLUMNS.includes(options.ORDER)) {
				throw new Error("ORDER must be a key in COLUMNS");
			}
		}
	}
	function validateFilter(filter: any) {
		if (Object.keys(filter).length === 0) return;

		const key = Object.keys(filter)[0];
		const value = filter[key];

		if (key === "AND" || key === "OR") {
			if (!Array.isArray(value) || value.length === 0) {
				throw new Error(`${key} must be a non-empty array of FILTER objects`);
			}
			value.forEach(validateFilter);
			return;
		}

		if (key === "NOT") {
			if (typeof value !== "object") {
				throw new Error("NOT must be a FILTER object");
			}
			validateFilter(value);
			return;
		}

		if (["LT", "GT", "EQ"].includes(key)) {
			validateMComparison(key, value);
			return;
		}

		if (key === "IS") {
			validateSComparison(value);
			return;
		}

		throw new Error("WHERE must be an object with at most one FILTER");
	}
	function validateSComparison(obj: any) {
		const keys = Object.keys(obj);

		if (keys.length !== 1 || !sfields.includes(keys[0]) || typeof obj[keys[0]] !== "string") {
			throw new Error("IS must be an object with one sfield of type string");
		}

		const value = obj[keys[0]];
		const starCount = (value.match(/\*/g) || []).length;

		if (starCount > 2 || (starCount === 2 && !(value.startsWith("*") && value.endsWith("*")))) {
			throw new Error("IS asterisks can only be first or last character");
		}

		if (value.slice(1, -1).includes("*")) {
			throw new Error("IS asterisks can only be first or last character");
		}
	}
	function executeQuery(query: any) {
		const sections = model.getSections();

		const filtered = sections.filter((section) => evaluateFilter(query.WHERE, section));

		let projected = filtered.map((section) => projectRow(section, query.OPTIONS.COLUMNS));

		if (query.OPTIONS.ORDER) {
			const key = query.OPTIONS.ORDER;
			projected.sort((a, b) => {
				if (a[key] < b[key]) return -1;
				if (a[key] > b[key]) return 1;

				if (a.id < b.id) return -1;
				if (a.id > b.id) return 1;

				return 0;
			});
		}

		return projected;
	}
	function evaluateFilter(filter: any, section: Section): boolean {
		if (Object.keys(filter).length === 0) return true;

		const key = Object.keys(filter)[0];
		const value = filter[key];

		if (key === "AND") {
			return value.every((f: any) => evaluateFilter(f, section));
		}

		if (key === "OR") {
			return value.some((f: any) => evaluateFilter(f, section));
		}

		if (key === "NOT") {
			return !evaluateFilter(value, section);
		}

		if (key === "LT") {
			const field = Object.keys(value)[0];
			return section[field as keyof Section] < value[field];
		}

		if (key === "GT") {
			const field = Object.keys(value)[0]; // e.g., "avg"
			return section[field as keyof Section] > value[field];
		}

		if (key === "EQ") {
			const field = Object.keys(value)[0];
			return section[field as keyof Section] === value[field];
		}

		if (key === "IS") {
			const field = Object.keys(value)[0];
			const pattern = value[field];

			// Logic to handle course-level fields vs section-level fields
			if (sfields.includes(field) && field !== "instructor") {
				const course = model.getCourseById(section.courseId);
				const val = course ? (course as any)[field] : "";
				return matchWildcard(val, pattern);
			}

			return matchWildcard(section[field as keyof Section] as string, pattern);
		}
		return false;
	}
	function matchWildcard(text: string, pattern: string): boolean {
		if (!pattern.includes("*")) return text === pattern;

		if (pattern.startsWith("*") && pattern.endsWith("*")) {
			return text.includes(pattern.slice(1, -1));
		}

		if (pattern.startsWith("*")) {
			return text.endsWith(pattern.slice(1));
		}

		if (pattern.endsWith("*")) {
			return text.startsWith(pattern.slice(0, -1));
		}

		return false;
	}
	function projectRow(section: Section, columns: string[]) {
		const course = model.getCourseById(section.courseId);

		const row: any = {};

		for (const col of columns) {
			if (mfields.includes(col)) {
				row[col] = section[col as keyof Section];
			} else if (col === "title") {
				row[col] = course?.title;
			} else if (col === "dept") {
				row[col] = course?.dept;
			} else if (col === "code") {
				row[col] = course?.code;
			} else if (col === "instructor") {
				row[col] = section.instructor;
			}
		}

		return row;
	} // End of AI Code

	return app;
}

type Data = {
	courses: Course[];
	sections: Section[];
};

class Model {
	private filepath: string; // start of genai (6 lines)
	private courseMap: Map<string, Course> = new Map();
	private sectionMap: Map<string, Section> = new Map();

	private constructor(filepath: string, data: Data) {
		this.filepath = filepath;
		for (const course of data.courses) this.courseMap.set(course.id, course);
		for (const section of data.sections) this.sectionMap.set(`${section.courseId}:${section.id}`, section);
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
		// use of genai in this function
		try {
			const dir = path.dirname(this.filepath);
			await fs.mkdir(dir, { recursive: true });
			const data = { courses: Array.from(this.courseMap.values()), sections: Array.from(this.sectionMap.values()) };
			await fs.writeFile(this.filepath, JSON.stringify(data, null, 2), "utf-8");
		} catch {
			// ignore, only fails in testing when datadir is deleted
		}
	}

	// --- COURSE METHODS ---

	public getCourses(): Course[] {
		return Array.from(this.courseMap.values());
	}

	public getCourseById(id: string): Course | undefined {
		return this.courseMap.get(id);
	}

	public setCourse(id: string, title: string, dept: string, code: string): Course {
		let course = this.getCourseById(id);
		if (course) {
			course.title = title;
			course.dept = dept;
			course.code = code;
		} else {
			course = { id, title, dept, code, sectionIds: [], latestYear: -Infinity };
			this.courseMap.set(id, course);
		}

		return course;
	}

	public async delCourse(id: string): Promise<void> {
		if (!this.courseMap.has(id)) {
			return;
		}

		// delete associated sections
		const course = this.getCourseById(id);
		const sectionIds = course?.sectionIds; // course cannot be undefined
		if (sectionIds) {
			for (const sectionId of sectionIds) {
				await this.delSection(sectionId, course.id);
			}
		}

		this.courseMap.delete(id);

		await this.writeModel();
		return;
	}

	// --- SECTION METHODS ---

	public getSections(): Section[] {
		return Array.from(this.sectionMap.values());
	}

	public getSectionById(id: string, courseId: string): Section | undefined {
		return this.sectionMap.get(`${courseId}:${id}`);
	}

	public setSection(
		courseId: string,
		id: string,
		instructor: string,
		year: number,
		avg: number,
		pass: number,
		fail: number,
		audit: number
	): Section {
		let section = this.getSectionById(id, courseId);
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
			this.sectionMap.set(`${courseId}:${id}`, section);

			const course = this.getCourseById(courseId);
			if (course && !course.sectionIds.includes(id)) {
				course.sectionIds.push(id);
			}
		}

		return section;
	}

	public async delSection(id: string, courseID: string): Promise<void> {
		const key = `${courseID}:${id}`;
		if (!this.sectionMap.has(key)) {
			return;
		}
		this.sectionMap.delete(key);

		// delete from parent
		const course = this.getCourseById(courseID);
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
	latestYear: number;
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
