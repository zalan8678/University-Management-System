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

	// provided example
	// 1
	app.get("/api/v1/orgs", (req, res) => {
		const orgs = model.getOrgs();
		const body = orgs.map((org) => {
			return {
				id: org.id,
				name: org.name,
				links: {
					self: `${req.originalUrl}/${org.id}`,
					courses: org.courseIds.map((id) => `${req.originalUrl}/${org.id}/courses/${id}`),
				},
			};
		});
		res.status(200).send(body);
	});

	// 2
	app.get("/api/v1/orgs/:orgId", (req, res) => {
		const org = model.getOrgById(req.params.orgId);

		if (!org) {
			res.status(404).send({
				error: "Not found",
				message: `no org with id '${req.params.orgId}'`,
			});
			return;
		} else {
			res.status(200).send({
				id: org.id,
				name: org.name,
				links: {
					self: `${req.originalUrl}`,
					courses: org.courseIds.map((id) => `${req.originalUrl}/${org.id}/courses/${id}`),
				},
			});
		}
	});

	// provided example
	// 3
	app.put("/api/v1/orgs/:orgId", async (req, res) => {
		const name = req.body?.name;
		if (name === undefined) {
			res.status(422).send({
				error: "Validation failed",
				fields: {
					name: "required but missing",
				},
			});
			return;
		} else if (typeof name !== "string") {
			res.status(422).send({
				error: "Validation failed",
				fields: {
					name: "expected a string",
				},
			});
			return;
		}

		const org = model.getOrgById(req.params.orgId);
		const newOrg = await model.setOrg(req.params.orgId, req.body.name);

		if (!org) {
			res.status(201).send({
				id: newOrg.id,
				name: newOrg.name,
				links: {
					self: req.originalUrl,
					courses: [], // can't have courses (its new)
				},
			});
		} else {
			res.sendStatus(204); // overwrite
		}
	});

	// 4
	app.delete("/api/v1/orgs/:orgId", async (req, res) => {
		const org = model.getOrgById(req.params.orgId);

		if (!org) {
			res.status(404).send({
				error: "Not found",
				message: `no org with id '${req.params.orgId}'`,
			});
			return;
		}

		await model.delOrg(req.params.orgId);
		res.status(200).send({
			id: org.id,
			name: org.name,
			courses: org.courseIds.map((id) => `${req.originalUrl}/courses/${id}`),
		});
	});

	// 5
	app.get("/api/v1/orgs/:orgId/courses", (req, res) => {
		// get org
		const org = model.getOrgById(req.params.orgId);
		if (!org) {
			res.status(404).send({
				error: "Not found",
				message: `no org with id '${req.params.orgId}'`,
			});
			return;
		}

		// get courses
		const courses = model.getCourses().filter((course) => course.orgId === req.params.orgId);
		const body = courses.map((course) => {
			return {
				id: course.id,
				title: course.title,
				dept: course.dept,
				code: course.code,
				links: {
					self: `${req.originalUrl}/${course.id}`,
					org: `/api/v1/orgs/${req.params.orgId}`,
					sections: course.sectionIds.map((id) => `${req.originalUrl}/${course.id}/sections/${id}`),
				},
			};
		});
		res.status(200).send(body);
	});

	// 6
	app.get("/api/v1/orgs/:orgId/courses/:courseId", (req, res) => {
		// get org
		const org = model.getOrgById(req.params.orgId);
		if (!org) {
			res.status(404).send({
				error: "Not found",
				message: `no org with id '${req.params.orgId}'`,
			});
			return;
		}

		// get course
		const course = model.getCourseById(req.params.courseId);
		if (!course || course.orgId != req.params.orgId) {
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
				self: `${req.originalUrl}`,
				org: `/api/v1/orgs/${req.params.orgId}`,
				sections: course.sectionIds.map((id) => `${req.originalUrl}/sections/${id}`),
			},
		});
	});

	// 7
	app.put("/api/v1/orgs/:orgId/courses/:courseId", async (req, res) => {
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

		// if (typeof title !== "string" || typeof dept !== "string" || typeof code !== "string") {
		// 	res.status(422).send({
		// 		error: "Validation failed",
		// 		fields: {
		// 			name: "required but missing",
		// 		},
		// 	});
		// 	return;
		// }

		// get org
		const org = model.getOrgById(req.params.orgId);
		if (!org) {
			res.status(404).send({
				error: "Not found",
				message: `no org with id '${req.params.orgId}'`,
			});
			return;
		}

		// get course
		const course = model.getCourseById(req.params.courseId);
		const newCourse = await model.setCourse(
			req.params.orgId,
			req.params.courseId,
			req.body.title,
			req.body.dept,
			req.body.code
		);

		if (!(course && course.orgId === req.params.orgId)) {
			// does not exist OR be part of correct parent org
			res.status(201).send({
				id: newCourse.id,
				title: newCourse.title,
				dept: newCourse.dept,
				code: newCourse.code,
				links: {
					self: req.originalUrl,
					org: `/api/v1/orgs/${req.params.orgId}`,
					sections: [], // can't have sections (new)
				},
			});
		} else {
			res.sendStatus(204); // overwrite
		}
	});

	// 8
	app.delete("/api/v1/orgs/:orgId/courses/:courseId", async (req, res) => {
		// get org
		const org = model.getOrgById(req.params.orgId);
		if (!org) {
			res.status(404).send({
				error: "Not found",
				message: `no org with id '${req.params.orgId}'`,
			});
			return;
		}

		// get course
		const course = model.getCourseById(req.params.courseId);
		if (!course || course.orgId != req.params.orgId) {
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
			sections: course.sectionIds.map((id) => `${req.originalUrl}/sections/${id}`),
		});
	});

	// 9
	app.get("/api/v1/orgs/:orgId/courses/:courseId/sections", (req, res) => {
		// get org
		const org = model.getOrgById(req.params.orgId);
		if (!org) {
			res.status(404).send({
				error: "Not found",
				message: `no org with id '${req.params.orgId}'`,
			});
			return;
		}

		// get course
		const course = model.getCourseById(req.params.courseId);
		if (!course || course.orgId != req.params.orgId) {
			res.status(404).send({
				error: "Not found",
				message: `no course with id '${req.params.courseId}'`,
			});
			return;
		}

		// get sections
		const sections = model.getSections().filter((section) => section.courseId === req.params.courseId);
		const body = sections.map((section) => {
			return {
				id: section.id,
				instructor: section.instructor,
				year: section.year,
				avg: section.avg,
				pass: section.pass,
				fail: section.fail,
				audit: section.audit,
				links: {
					self: `${req.originalUrl}/${section.id}`,
					course: `/api/v1/orgs/${req.params.orgId}/courses/${req.params.courseId}`,
				},
			};
		});
		res.status(200).send(body);
	});

	// 10
	app.get("/api/v1/orgs/:orgId/courses/:courseId/sections/:sectionId", (req, res) => {
		// get org
		const org = model.getOrgById(req.params.orgId);
		if (!org) {
			res.status(404).send({
				error: "Not found",
				message: `no org with id '${req.params.orgId}'`,
			});
			return;
		}

		// get course
		const course = model.getCourseById(req.params.courseId);
		if (!course || course.orgId != req.params.orgId) {
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
	app.put("/api/v1/orgs/:orgId/courses/:courseId/sections/:sectionId", async (req, res) => {
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

		if (typeof year !== "number") {
			fields.year = "required but missing";
		} else if (year < 1900 || year > 2099) {
			fields.year = "expected a number between 1900 and 2099";
		}

		if (typeof avg !== "number") {
			fields.avg = "required but missing";
		} else if (avg < 0 || avg > 100) {
			fields.avg = "expected a number between 0 and 100";
		}

		if (typeof pass !== "number") {
			fields.pass = "required but missing";
		} else if (pass < 0) {
			fields.pass = "expected a number >= 0";
		}

		if (typeof fail !== "number") {
			fields.fail = "required but missing";
		} else if (fail < 0) {
			fields.fail = "expected a number >= 0";
		}

		if (typeof audit !== "number") {
			fields.audit = "required but missing";
		} else if (audit < 0) {
			fields.audit = "expected a number >= 0";
		}

		if (Object.keys(fields).length > 0) {
			res.status(422).send({
				error: "Validation failed",
				fields,
			});
			return;
		} // end of ai generated

		// get org
		const org = model.getOrgById(req.params.orgId);
		if (!org) {
			res.status(404).send({
				error: "Not found",
				message: `no org with id '${req.params.orgId}'`,
			});
			return;
		}

		// get course
		const course = model.getCourseById(req.params.courseId);
		if (!course || course.orgId != req.params.orgId) {
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
					course: `/api/v1/orgs/${req.params.orgId}/courses/${req.params.courseId}`,
				},
			});
		} else {
			// overwrite
			res.sendStatus(204);
		}
	});

	// 12
	app.delete("/api/v1/orgs/:orgId/courses/:courseId/sections/:sectionId", async (req, res) => {
		// get org
		const org = model.getOrgById(req.params.orgId);
		if (!org) {
			res.status(404).send({
				error: "Not found",
				message: `no org with id '${req.params.orgId}'`,
			});
			return;
		}

		// get course
		const course = model.getCourseById(req.params.courseId);
		if (!course || course.orgId != req.params.orgId) {
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
	orgs: Org[];
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
				orgs: Array.isArray(parsed.orgs) ? parsed.orgs : [],
				courses: Array.isArray(parsed.courses) ? parsed.courses : [],
				sections: Array.isArray(parsed.sections) ? parsed.sections : [],
			}; // end of ai generated
			return new Model(filepath, data);
		} catch {
			return new Model(filepath, { orgs: [], courses: [], sections: [] }); // file does not exist, create blank file?
		}
	}

	async writeModel(): Promise<void> {
		const dir = path.dirname(this.filepath);
		await fs.mkdir(dir, { recursive: true });
		await fs.writeFile(this.filepath, JSON.stringify(this.data, null, 2), "utf-8");
	}

	// --- ORG METHODS ---

	public getOrgs(): Org[] {
		return this.data.orgs;
	}

	public getOrgById(id: string): Org | undefined {
		return this.data.orgs.find((org) => org.id === id);
	}

	public async setOrg(id: string, name: string): Promise<Org> {
		let org = this.getOrgById(id);
		if (org) {
			org.name = name;
		} else {
			org = { id, name, courseIds: [] };
			this.data.orgs.push(org);
		}
		await this.writeModel();
		return org;
	}

	public async delOrg(id: string): Promise<void> {
		// assumes org exists
		const orgIndex = this.data.orgs.findIndex((org) => org.id === id);

		if (orgIndex == -1) {
			return;
		}

		this.data.orgs.splice(orgIndex, 1);
		await this.writeModel();
		return;
	}

	// --- COURSE METHODS ---

	public getCourses(): Course[] {
		return this.data.courses;
	}

	public getCourseById(id: string): Course | undefined {
		return this.data.courses.find((course) => course.id === id);
	}

	public async setCourse(orgId: string, id: string, title: string, dept: string, code: string): Promise<Course> {
		let course = this.getCourseById(id);
		if (course) {
			course.title = title;
			course.dept = dept;
			course.code = code;
			course.orgId = orgId;
		} else {
			course = { id, title, dept, code, orgId, sectionIds: [] };
			this.data.courses.push(course);

			const org = this.getOrgById(orgId);
			if (org && !org.courseIds.includes(id)) {
				org.courseIds.push(id);
			}
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

		const orgid = this.getCourseById(id)?.orgId as string; // save id

		this.data.courses.splice(courseIndex, 1); // delete course

		// delete from parent
		const org = this.getOrgById(orgid);
		if (org && org.courseIds.includes(id)) {
			const parentIndex = org.courseIds.findIndex((courseId) => courseId === id);
			if (parentIndex !== -1) {
				org.courseIds.splice(parentIndex, 1);
			}
		}

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

export interface Org {
	id: string;
	name: string;
	courseIds: string[];
}

export interface Course {
	id: string;
	title: string;
	dept: string;
	code: string;
	orgId: string;
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
