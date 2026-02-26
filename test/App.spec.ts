import fs from "fs/promises";
import { expect } from "chai";
import request from "supertest";
import { StatusCodes } from "http-status-codes";
import { Application, createApp } from "../src/App";
import path from "path";

const {
	OK, // 200
	// Other common codes are:
	CREATED, // 201
	NO_CONTENT, // 204
	NOT_FOUND, // 404
} = StatusCodes;

// Do not change datadir
const datadir = "./data" as const;

describe("REST API v1", function () {
	let app: Application;

	beforeEach(async () => {
		app = await createApp({ datadir });
	});

	afterEach(async () => {
		await fs.rm(datadir, { recursive: true, force: true });
	});

	it("SANITY: GET /api should respond with status OK and text 'App is running!'", async () => {
		// PROVIDED
		const res = await request(app).get("/api");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.property("text", "App is running!");
	});

	it("1: GET /api should respond with status OK and text 'App is running!'", async () => {
		// PROVIDED
		const res = await request(app).get("/api");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.property("text", "App is running!");
	});
	it("2: GET /api/v1/courses should respond with status OK and body empty array and descriptors", async () => {
		// IN CLASS EXAMPLE
		const res = await request(app).get("/api/v1/courses");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 0,
			limit: 100,
			offset: 0,
			items: [],
		});
	});
	it("3: GET /api/v1/courses should respond with status OK and body empty array and descriptors for given properties", async () => {
		// IN CLASS EXAMPLE
		const res = await request(app).get("/api/v1/courses?limit=123&offset=200");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 0,
			limit: 123,
			offset: 200,
			items: [],
		});
	});
	it("4: GET /api/v1/courses/{course} should respond with status 404", async () => {
		const res = await request(app).get("/api/v1/courses/cpsc123");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no course with id 'cpsc123'",
		});
	});
	it("5: GET /api/v1/courses should respond with status 400 for invalid parameters", async () => {
		// IN CLASS EXAMPLE
		const res = await request(app).get("/api/v1/courses?limit=-1&offset=-34");
		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid request parameters",
			params: {
				limit: "expected an integer between 1 and 5000",
				offset: "expected an integer >= 0",
			},
		});
	});
	it("6: PUT /api/v1/courses/{course} should respond with status CREATED and body course data", async () => {
		const res = await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		expect(res).to.have.property("status", CREATED);
		expect(res).to.have.deep.property("body", {
			id: "cpsc310",
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
			links: {
				self: "/api/v1/courses/cpsc310",
				sections: `/api/v1/courses/cpsc310/sections`,
			},
		});
	});

	it("7: PUT /api/v1/courses/{course} should respond with status 204", async () => {
		// potential tests required for missing params when updating?
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		const res = await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Biology",
			code: "310",
		});

		expect(res).to.have.property("status", NO_CONTENT);
		expect(res).to.have.deep.property("body", {});
	});
	it("8: PUT /api/v1/courses/{course} should respond with status 422: Code Missing", async () => {
		const res = await request(app).put("/api/v1/courses/cpsc310").send({
			title: "title",
			dept: "Computer Science",
		});
		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: { code: "required but missing" },
		});
	});

	it("9: DEL /api/v1/courses/{course} should respond with status 200 and body course data", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		const res = await request(app).del("/api/v1/courses/cpsc310");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			id: "cpsc310",
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
			sections: 0,
		});
	});

	it("10b: PUT /api/v1/courses/{course}/sections/{section} should respond with status 204", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});

		const res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "reid",
			year: 2024,
			avg: 22.4,
			pass: 167,
			fail: 3,
			audit: 12,
		});

		expect(res).to.have.property("status", 204);
		expect(res).to.have.deep.property("body", {});
	});

	it("10c: PUT /api/v1/courses/{course}/sections/{section} should respond with status 404: Course not found", async () => {
		const res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});

		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no course with id 'cpsc310'",
		});
	});

	it("10d: PUT /api/v1/courses/{course}/sections/{section} should respond with status 422: required but missing", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({});

		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				instructor: "required but missing",
				year: "required but missing",
				avg: "required but missing",
				pass: "required but missing",
				fail: "required but missing",
				audit: "required but missing",
			},
		});
	});

	it("10e: PUT /api/v1/courses/{course}/sections/{section} should respond with status 422: lower bounds", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: 1,
			year: 1899,
			avg: -1,
			pass: -1,
			fail: -1,
			audit: -1,
		});

		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				instructor: "expected a string",
				year: "expected a number between 1900 and 2099",
				avg: "expected a number between 0 and 100",
				pass: "expected a number >= 0",
				fail: "expected a number >= 0",
				audit: "expected a number >= 0",
			},
		});
	});

	it("10f: PUT /api/v1/courses/{course}/sections/{section} should respond with status 422: upper bounds", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "reid",
			year: 2100,
			avg: 101,
			pass: 0,
			fail: 0,
			audit: 0,
		});

		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				year: "expected a number between 1900 and 2099",
				avg: "expected a number between 0 and 100",
			},
		});
	});
	it("11: GET /api/v1/courses/{course}/sections should respond with status OK and body params and empty array", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		const res = await request(app).get("/api/v1/courses/cpsc310/sections");

		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 0,
			limit: 100,
			offset: 0,
			items: [],
		});
	});

	/*it("12a: POST /api/v1/datasets should respond with status 202 and processing status", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "test_12a.zip"));
		const uploadRes = await request(app)
			.post("/api/v1/datasets")
			.field("kind", "course_offerings")
			.attach("archive", datasetBuffer, "courses.zip");

		expect(uploadRes).to.have.property("status", 202);
		expect(uploadRes).to.have.deep.property("body", {
			id: "upload_1",
			status: "processing",
			kind: "course_offerings",
			message: "Dataset accepted for processing",
		});
	});

	it("12b: POST /api/v1/datasets should respond with status 422: kind/archive required but missing", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "test_12a.zip"));
		const uploadRes = await request(app).post("/api/v1/datasets");

		expect(uploadRes).to.have.property("status", 422);
		expect(uploadRes).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				kind: "required but missing",
				archive: "required but missing",
			},
		});
	});

	it("12c: POST /api/v1/datasets should respond with status 422: expected to be course_offerings", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "test_12a.zip"));
		const uploadRes = await request(app)
			.post("/api/v1/datasets")
			.field("kind", "test")
			.attach("archive", datasetBuffer, "courses.zip");

		expect(uploadRes).to.have.property("status", 422);
		expect(uploadRes).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				kind: "expected to be course_offerings",
			},
		});
	});

	it("12d: POST /api/v1/datasets should respond with status 422: expected non-empty file", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "empty.zip"));
		const uploadRes = await request(app)
			.post("/api/v1/datasets")
			.field("kind", "course_offerings")
			.attach("archive", datasetBuffer, "courses.zip");

		expect(uploadRes).to.have.property("status", 422);
		expect(uploadRes).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				archive: "expected non-empty file",
			},
		});
	});

	// ai generated
	async function waitForGetCompletion(id: string) {
		let res;
		do {
			await new Promise((r) => setTimeout(r, 200));
			res = await request(app).get(`/api/v1/datasets/${id}`);
		} while (res.body.status === "processing");

		return res;
	}
	// end of ai generated

	it("13a: GET /api/v1/datasets/{id} should respond with status 200: Processing", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "test_12a.zip"));
		const uploadRes = await request(app)
			.post("/api/v1/datasets")
			.field("kind", "course_offerings")
			.attach("archive", datasetBuffer, "courses.zip");

		const getRes = await request(app).get(`/api/v1/datasets/upload_1`);

		expect(getRes).to.have.property("status", 200);

		expect(getRes).to.have.deep.property("body", {
			id: "upload_1",
			status: "processing",
			kind: "course_offerings",
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
		});
	});

	it("13b: GET /api/v1/datasets/{id} should respond with status 200: Completed", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "test_12a.zip"));
		const uploadRes = await request(app)
			.post("/api/v1/datasets")
			.field("kind", "course_offerings")
			.attach("archive", datasetBuffer, "courses.zip");

		const getRes = await waitForGetCompletion("upload_1");

		expect(getRes).to.have.property("status", 200);

		expect(getRes).to.have.deep.property("body", {
			id: "upload_1",
			status: "completed",
			kind: "course_offerings",
			stats: {
				files_total: 1,
				files_processed: 1,
				files_skipped: 0,
				courses_seen: 1,
				courses_added: 1,
				courses_modified: 0,
				sections_seen: 1,
				sections_added: 1,
				sections_modified: 0,
			},
			message: "Dataset processing complete",
		});
	});

	it("13c: GET /api/v1/datasets/{id} should respond with status 200: Failed - Invalid ZIP", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "txtfile.txt"));
		const uploadRes = await request(app)
			.post("/api/v1/datasets")
			.field("kind", "course_offerings")
			.attach("archive", datasetBuffer, "courses.zip");

		const getRes = await waitForGetCompletion("upload_1");

		expect(getRes).to.have.property("status", 200);

		expect(getRes).to.have.deep.property("body", {
			id: "upload_1",
			status: "failed",
			kind: "course_offerings",
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
			message: "Data is not in a valid zip format",
		});
	});

	it("13d: GET /api/v1/datasets/{id} should respond with status 200: Failed - Missing Root", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "wrongfolder.zip"));
		const uploadRes = await request(app)
			.post("/api/v1/datasets")
			.field("kind", "course_offerings")
			.attach("archive", datasetBuffer, "courses.zip");

		const getRes = await waitForGetCompletion("upload_1");

		expect(getRes).to.have.property("status", 200);

		expect(getRes).to.have.deep.property("body", {
			id: "upload_1",
			status: "failed",
			kind: "course_offerings",
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
			message: "Missing root courses directory",
		});
	});

	it("13e: GET /api/v1/datasets/{id} should respond with status 404: Not Found", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "test_12a.zip"));
		const uploadRes = await request(app)
			.post("/api/v1/datasets")
			.field("kind", "course_offerings")
			.attach("archive", datasetBuffer, "courses.zip");

		const getRes = await request(app).get("/api/v1/datasets/upload_2");

		expect(getRes).to.have.property("status", 404);

		expect(getRes).to.have.deep.property("body", {
			error: "Not found",
			message: "no dataset with id 'upload_2'",
		});
	});

	it("15: GET /api/v1/courses should respond with status OK and body empty array and descriptors for given properties", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).get("/api/v1/courses?limit=123&offset=200");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 1,
			limit: 123,
			offset: 200,
			items: [],
		});
	});
	it("16: GET /api/v1/courses should respond with status OK and body 1 course and descriptors for given properties", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/courses/weeb123").send({
			title: "Introduction to Japanese Media",
			dept: "Asian Studies",
			code: "123",
		});
		const res = await request(app).get("/api/v1/courses?limit=1&offset=1");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 2,
			limit: 1,
			offset: 1,
			items: [
				{
					id: "weeb123",
					title: "Introduction to Japanese Media",
					dept: "Asian Studies",
					code: "123",
					links: {
						self: "/api/v1/courses/weeb123",
						sections: "/api/v1/courses/weeb123/sections",
					},
				},
			],
		});
	});
	it("17: GET /api/v1/courses/cpsc310/sections/21w201 should respond with status OK and body 1 course and descriptors for given properties", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/21w202").send({
			instructor: "hinojosa, efrain",
			year: 2021,
			avg: 69,
			pass: 67,
			fail: 10,
			audit: 2,
		});
		const res = await request(app).get("/api/v1/courses/cpsc310/sections?limit=1&offset=1");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 2,
			limit: 1,
			offset: 1,
			items: [
				{
					id: "21w202",
					instructor: "hinojosa, efrain",
					year: 2021,
					avg: 69,
					pass: 67,
					fail: 10,
					audit: 2,
					links: {
						self: "/api/v1/courses/cpsc310/sections/21w202",
						course: "/api/v1/courses/cpsc310",
					},
				},
			],
		});
	});
	it("18: GET /api/v1/courses/cpsc310/sections/21w201 should respond with status OK and body 1 course and descriptors for given properties", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/courses/weeb123").send({
			title: "Introduction to Japanese Media",
			dept: "Asian Studies",
			code: "123",
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/21w202").send({
			instructor: "hinojosa, efrain",
			year: 2021,
			avg: 69,
			pass: 67,
			fail: 10,
			audit: 2,
		});
		await request(app).put("/api/v1/courses/weeb123/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).put("/api/v1/courses/weeb123/sections/21w202").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		const res = await request(app).get("/api/v1/courses/cpsc310/sections?limit=1&offset=1");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 2,
			limit: 1,
			offset: 1,
			items: [
				{
					id: "21w202",
					instructor: "hinojosa, efrain",
					year: 2021,
					avg: 69,
					pass: 67,
					fail: 10,
					audit: 2,
					links: {
						self: "/api/v1/courses/cpsc310/sections/21w202",
						course: "/api/v1/courses/cpsc310",
					},
				},
			],
		});
	});
	/*it("19: POST /api/v1/search should respond with status OK and body 3 depts", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "pair.zip"));
		const uploadRes = await request(app)
			.post("/api/v1/datasets")
			.field("kind", "course_offerings")
			.attach("archive", datasetBuffer, "courses.zip");

		const getRes = await waitForGetCompletion("upload_1");

		expect(getRes).to.have.property("status", 200);

		expect(getRes).to.have.deep.property("body", {
			id: "upload_1",
			status: "completed",
			kind: "course_offerings",
			stats: {
				files_total: 100,
				files_processed: 1,
				files_skipped: 0,
				courses_seen: 1,
				courses_added: 1,
				courses_modified: 0,
				sections_seen: 1,
				sections_added: 1,
				sections_modified: 0,
			},
			message: "Dataset processing complete",
		});
		const res = await request(app).post("/api/v1/search").send({
			kind: "course_offerings",
			query: {
				WHERE: {
					GT: {
						avg: 99
					}
				},
				OPTIONS: {
					COLUMNS: [
						"dept",
						"avg"
					],
					ORDER: "avg"
				}
			}
		});
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", [
			{
				dept: "cnps",
				avg: 99.19
			},
			{
				dept: "math",
				avg: 99.78
			},
			{
				dept: "math",
				avg: 99.78
			}
		])
	});*/
	/*it("19: POST /api/v1/search should respond with status 200 and filtered results", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "pair.zip"));

		// 1. Upload
		const uploadRes = await request(app)
			.post("/api/v1/datasets")
			.field("kind", "course_offerings")
			.attach("archive", datasetBuffer, "pair.zip");

		expect(uploadRes.status).to.equal(202);
		const datasetId = uploadRes.body.id; // Get the actual ID generated

		// 2. Wait for background processing to finish
		const getRes = await waitForGetCompletion(datasetId);
		expect(getRes?.body.status).to.equal("completed");

		// 3. Search
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {
						GT: { avg: 99 }
					},
					OPTIONS: {
						COLUMNS: ["dept", "avg"],
						ORDER: "avg"
					}
				}
			});

		// 4. Assertions
		expect(res.status).to.equal(200);

		// IMPORTANT: Your controller returns { result: [...] }, not just the array
		expect(res.body).to.have.property("result");
		expect(res.body.result).to.be.an("array");

		// Verify the data matches your example
		expect(res.body.result).to.deep.equal([
			{ dept: "cnps", avg: 99.19 },
			{ dept: "math", avg: 99.78 },
			{ dept: "math", avg: 99.78 }
		]);
	});*/
	it("19: POST /api/v1/search should respond with status 200 and filtered results", async () => {
		await request(app).put("/api/v1/courses/weeb123").send({
			title: "Introduction to Japanese Media",
			dept: "Asian Studies",
			code: "123",
		});
		await request(app).put(`/api/v1/courses/weeb123/sections/sec123`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 96,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).put(`/api/v1/courses/weeb123/sections/sec123`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 96,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).put("/api/v1/courses/doom999").send({
			title: "Introduction to Tanking GPA",
			dept: "DOOM",
			code: "999",
		});
		await request(app).put(`/api/v1/courses/doom999/sections/sec123`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 50,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).put(`/api/v1/courses/doom999/sections/sec124`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 54,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		// 3. Search
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {
						GT: { avg: 90 },
					},
					OPTIONS: {
						COLUMNS: ["dept", "avg"],
						ORDER: "avg",
					},
				},
			});

		// 4. Assertions
		expect(res.status).to.equal(200);

		// IMPORTANT: Your controller returns { result: [...] }, not just the array
		expect(res.body).to.have.property("result");
		expect(res.body.result).to.be.an("array");

		// Verify the data matches your example
		expect(res.body.result).to.deep.equal([{ dept: "Asian Studies", avg: 96 }]);
	});
	it("20: POST /api/v1/search should respond with validation errors", async () => {
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					OPTIONS: {
						COLUMNS: ["dept", "avg"],
						ORDER: "avg",
					},
				},
			});
		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Missing WHERE",
		});
	});
	/*// Generated by AI
	async function populateInChunks(total: number, chunkSize: number) {
		for (let i = 0; i < total; i += chunkSize) {
			const batch = [];
			// Create a chunk of promises
			for (let j = i; j < i + chunkSize && j < total; j++) {
				batch.push(
					request(app)
						.put(`/api/v1/courses/weeb123/sections/s${j}`)
						.send({
							instructor: "R", year: 2021, avg: 85,
							pass: 50, fail: 0, audit: 0
						})
				);
			}

			// Wait for this chunk to finish
			await Promise.all(batch);

			// Give the file system a tiny break to prevent Parse Error / ECONNRESET
			await new Promise(resolve => setTimeout(resolve, 50));
		}
	}
	// End of AI Code
	it("21: POST /api/v1/search should respond with status 413 and overflow error", async () => {
		this.timeout(30000);
		await request(app).put("/api/v1/courses/weeb123").send({
			title: "Introduction to Japanese Media",
			dept: "Asian Studies",
			code: "123",
		});
		await populateInChunks(5001, 900);
		const res = await request(app).post("/api/v1/search").send({
			kind: "course_offerings",
			query: {
				WHERE: {
					GT: {
						avg: 0
					}
				},
				OPTIONS: {
					COLUMNS: [
						"dept",
						"avg"
					],
					ORDER: "avg"
				}
			}
		});
		expect(res).to.have.property("status", 413);
		expect(res).to.have.deep.property("body", {
			error: "Too many results",
			message: "Query would return more than 5000 results",
			limit: 5000
		})
	});

	it("22: POST /api/v1/search should respond with status 422 and validation error", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "pair.zip"));
		const uploadRes = await request(app)
			.post("/api/v1/datasets")
			.field("kind", "course_offerings")
			.attach("archive", datasetBuffer, "courses.zip");

		const getRes = await waitForGetCompletion("upload_1");

		const res = await request(app).post("/api/v1/search").send({
			query: {
				WHERE: {
					GT: {
						avg: 99
					}
				},
				OPTIONS: {
					COLUMNS: [
						"dept",
						"avg"
					],
					ORDER: "avg"
				}
			}
		});
		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				kind: "required but missing"
			}
		})
	}); */
	/*it("23: POST /api/v1/search should respond with complex query", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "pair.zip"));
		const uploadRes = await request(app)
			.post("/api/v1/datasets")
			.field("kind", "course_offerings")
			.attach("archive", datasetBuffer, "courses.zip");

		const getRes = await waitForGetCompletion("upload_1");
		const res = await request(app).post("/api/v1/search").send({
			kind: "course_offerings",
			query: {
				WHERE: {
					OR: [
						{
							AND: [
								{
									GT: {
										avg: 90
									}
								},
								{
									IS: {
										dept: "adhe"
									}
								}
							]
						},
						{
							EQ: {
								avg: 95
							}
						}
					]
				},
				OPTIONS: {
					COLUMNS: [
						"dept",
						"avg"
					],
					ORDER: "avg"
				}
			}
		});
		expect(res).to.have.property("status", OK);
		expect(res.body).to.deep.equal([
			{
				dept: "adhe",
				avg: 90.02
			},
			{
				dept: "adhe",
				avg: 90.16
			},
			{
				dept: "adhe",
				avg: 90.17
			},
			{
				dept: "adhe",
				avg: 90.18
			},
			{
				dept: "adhe",
				avg: 90.5
			},
			{
				dept: "adhe",
				avg: 90.72
			},
			{
				dept: "adhe",
				avg: 90.82
			},
			{
				dept: "adhe",
				avg: 90.85
			},
			{
				dept: "adhe",
				avg: 91.29
			},
			{
				dept: "adhe",
				avg: 91.33
			},
			{
				dept: "adhe",
				avg: 91.33
			},
			{
				dept: "adhe",
				avg: 91.48
			},
			{
				dept: "adhe",
				avg: 92.54
			},
			{
				dept: "adhe",
				avg: 93.33
			},
			{
				dept: "sowk",
				avg: 95
			},
			{
				dept: "rhsc",
				avg: 95
			},
			{
				dept: "psyc",
				avg: 95
			},
			{
				dept: "psyc",
				avg: 95
			},
			{
				dept: "obst",
				avg: 95
			},
			{
				dept: "nurs",
				avg: 95
			},
			{
				dept: "nurs",
				avg: 95
			},
			{
				dept: "musc",
				avg: 95
			},
			{
				dept: "musc",
				avg: 95
			},
			{
				dept: "musc",
				avg: 95
			},
			{
				dept: "musc",
				avg: 95
			},
			{
				dept: "musc",
				avg: 95
			},
			{
				dept: "musc",
				avg: 95
			},
			{
				dept: "mtrl",
				avg: 95
			},
			{
				dept: "mtrl",
				avg: 95
			},
			{
				dept: "mtrl",
				avg: 95
			},
			{
				dept: "math",
				avg: 95
			},
			{
				dept: "math",
				avg: 95
			},
			{
				dept: "kin",
				avg: 95
			},
			{
				dept: "kin",
				avg: 95
			},
			{
				dept: "kin",
				avg: 95
			},
			{
				dept: "epse",
				avg: 95
			},
			{
				dept: "epse",
				avg: 95
			},
			{
				dept: "epse",
				avg: 95
			},
			{
				dept: "edcp",
				avg: 95
			},
			{
				dept: "edcp",
				avg: 95
			},
			{
				dept: "econ",
				avg: 95
			},
			{
				dept: "econ",
				avg: 95
			},
			{
				dept: "crwr",
				avg: 95
			},
			{
				dept: "crwr",
				avg: 95
			},
			{
				dept: "crwr",
				avg: 95
			},
			{
				dept: "crwr",
				avg: 95
			},
			{
				dept: "crwr",
				avg: 95
			},
			{
				dept: "crwr",
				avg: 95
			},
			{
				dept: "crwr",
				avg: 95
			},
			{
				dept: "cpsc",
				avg: 95
			},
			{
				dept: "cpsc",
				avg: 95
			},
			{
				dept: "cnps",
				avg: 95
			},
			{
				dept: "cnps",
				avg: 95
			},
			{
				dept: "bmeg",
				avg: 95
			},
			{
				dept: "bmeg",
				avg: 95
			},
			{
				dept: "adhe",
				avg: 96.11
			}
		]);
	});*/
	it("25: DEL /api/v1/courses/{course}/sections/{section} should respond with status 200 and body section data", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});

		const res = await request(app).del("/api/v1/courses/cpsc310/sections/21w201");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			id: "21w201",
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
	});
	it("26: POST /api/v1/search should respond with status 200 and filtered results", async () => {
		await request(app).put("/api/v1/courses/weeb123").send({
			title: "Introduction to Japanese Media",
			dept: "Asian Studies",
			code: "123",
		});
		await request(app).put(`/api/v1/courses/weeb123/sections/sec123`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 95,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).put(`/api/v1/courses/weeb123/sections/sec124`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 96,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).put("/api/v1/courses/doom999").send({
			title: "Introduction to Tanking GPA",
			dept: "DOOM",
			code: "999",
		});
		await request(app).put(`/api/v1/courses/doom999/sections/sec123`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 50,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).put(`/api/v1/courses/doom999/sections/sec124`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 54,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		// 3. Search
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {
						OR: [
							{
								AND: [
									{
										GT: {
											avg: 52,
										},
									},
									{
										IS: {
											dept: "DOOM",
										},
									},
								],
							},
							{
								EQ: {
									avg: 95,
								},
							},
						],
					},
					OPTIONS: {
						COLUMNS: ["dept", "avg"],
						ORDER: "avg",
					},
				},
			});
		// 4. Assertions
		expect(res.status).to.equal(200);

		// IMPORTANT: Your controller returns { result: [...] }, not just the array
		expect(res.body).to.have.property("result");
		expect(res.body.result).to.be.an("array");

		// Verify the data matches your example
		expect(res.body.result).to.deep.equal([
			{ dept: "DOOM", avg: 54 },
			{ dept: "Asian Studies", avg: 95 },
		]);
	});
	it("27: POST /api/v1/search with wildcards should respond with status 200 and filtered results", async () => {
		await request(app).put("/api/v1/courses/weeb123").send({
			title: "Introduction to Japanese Media",
			dept: "Asian Studies",
			code: "123",
		});
		await request(app).put(`/api/v1/courses/weeb123/sections/sec123`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 95,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).put(`/api/v1/courses/weeb123/sections/sec124`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 96,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).put("/api/v1/courses/doom999").send({
			title: "Introduction to Tanking GPA",
			dept: "DOOM",
			code: "999",
		});
		await request(app).put(`/api/v1/courses/doom999/sections/sec123`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 50,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).put(`/api/v1/courses/doom999/sections/sec124`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 54,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).put("/api/v1/courses/amer102").send({
			title: "Introduction to American Media",
			dept: "American Studies",
			code: "102",
		});
		await request(app).put(`/api/v1/courses/amer102/sections/sec124`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 54,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		// 3. Search
		const res = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {
						IS: { dept: "A*" },
					},
					OPTIONS: {
						COLUMNS: ["dept", "avg"],
						ORDER: "avg",
					},
				},
			});
		// 4. Assertions
		expect(res.status).to.equal(200);

		// IMPORTANT: Your controller returns { result: [...] }, not just the array
		expect(res.body).to.have.property("result");
		expect(res.body.result).to.be.an("array");

		// Verify the data matches your example
		expect(res.body.result).to.deep.equal([
			{ dept: "American Studies", avg: 54 },
			{ dept: "Asian Studies", avg: 95 },
			{ dept: "Asian Studies", avg: 96 },
		]);
		const res2 = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {
						IS: { dept: "*Studies*" },
					},
					OPTIONS: {
						COLUMNS: ["dept", "avg"],
						ORDER: "avg",
					},
				},
			});
		expect(res2.body.result).to.deep.equal([
			{ dept: "American Studies", avg: 54 },
			{ dept: "Asian Studies", avg: 95 },
			{ dept: "Asian Studies", avg: 96 },
		]);
	});
	it("28: GET /api/v1/courses/cpsc310/sections/2021 should respond with status OK and body section", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/courses/weeb123").send({
			title: "Introduction to Japanese Media",
			dept: "Asian Studies",
			code: "123",
		});
		const res = await request(app).get("/api/v1/courses?limit=1&offset=1");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 2,
			limit: 1,
			offset: 1,
			items: [
				{
					id: "weeb123",
					title: "Introduction to Japanese Media",
					dept: "Asian Studies",
					code: "123",
					links: {
						self: "/api/v1/courses/weeb123",
						sections: "/api/v1/courses/weeb123/sections",
					},
				},
			],
		});
	});
	it("29: POST /api/v1/search with wildcards edge case should respond with status 200 and filtered results", async () => {
		await request(app).put("/api/v1/courses/weeb123").send({
			title: "Introduction to Japanese Media",
			dept: "Asian Studies",
			code: "123",
		});
		await request(app).put("/api/v1/courses/amer102").send({
			title: "Introduction to American Media",
			dept: "American Studies",
			code: "102",
		});
		await request(app).put(`/api/v1/courses/amer102/sections/sec124`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 54,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).put("/api/v1/courses/doom999").send({
			title: "Introduction to Tanking GPA",
			dept: "DOOM",
			code: "999",
		});
		await request(app).put(`/api/v1/courses/weeb123/sections/sec123`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 95,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).put(`/api/v1/courses/weeb123/sections/sec124`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 96,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).put(`/api/v1/courses/doom999/sections/sec123`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 50,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).put(`/api/v1/courses/doom999/sections/sec124`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 54,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		const res2 = await request(app)
			.post("/api/v1/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {
						IS: { dept: "*" },
					},
					OPTIONS: {
						COLUMNS: ["dept", "avg"],
						ORDER: "avg",
					},
				},
			});
		expect(res2.body.result).to.deep.equal([
			{ dept: "DOOM", avg: 50 },
			{ dept: "American Studies", avg: 54 },
			{ dept: "DOOM", avg: 54 },
			{ dept: "Asian Studies", avg: 95 },
			{ dept: "Asian Studies", avg: 96 },
		]);
	});
	it("30: PUT /api/v1/courses/cpsc310/sections/21w201 should return validation errors", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		const res = await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "Nick Bradley",
			year: 2021,
			avg: 200,
			pass: NaN,
			fail: "-5",
			audit: -10,
		});

		expect(res.status).to.equal(422);

		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				avg: "expected a number between 0 and 100",
				pass: "expected a number >= 0",
				fail: "expected a number >= 0",
				audit: "expected a number >= 0",
			},
		});
	});
});
