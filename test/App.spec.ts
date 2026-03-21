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
		await fs.rm("./data", { recursive: true, force: true });
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

	it("12a: POST /api/v2/datasets should respond with status 202 and processing status", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "test_12a.zip"));
		const uploadRes = await request(app)
			.post("/api/v2/datasets")
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

	it("12b: POST /api/v2/datasets should respond with status 422: kind/archive required but missing", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "test_12a.zip"));
		const uploadRes = await request(app).post("/api/v2/datasets");

		expect(uploadRes).to.have.property("status", 422);
		expect(uploadRes).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				kind: "required but missing",
				archive: "required but missing",
			},
		});
	});

	it("12c: POST /api/v2/datasets should respond with status 422: expected to be course_offerings", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "test_12a.zip"));
		const uploadRes = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "test")
			.attach("archive", datasetBuffer, "courses.zip");

		expect(uploadRes).to.have.property("status", 422);
		expect(uploadRes).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				kind: "expected to be course_offerings or facilities",
			},
		});
	});

	it("12d: POST /api/v2/datasets should respond with status 422: expected non-empty file", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "empty.zip"));
		const uploadRes = await request(app)
			.post("/api/v2/datasets")
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
			res = await request(app).get(`/api/v2/datasets/${id}`);
		} while (res.body.status === "processing");

		return res;
	}
	// end of ai generated

	// it("13a: GET /api/v1/datasets/{id} should respond with status 200: Processing", async () => {
	// 	const datasetBuffer = await fs.readFile(path.resolve(__dirname, "test_12a.zip"));
	// 	const uploadRes = await request(app)
	// 		.post("/api/v1/datasets")
	// 		.field("kind", "course_offerings")
	// 		.attach("archive", datasetBuffer, "courses.zip");

	// 	const getRes = await request(app).get(`/api/v1/datasets/upload_1`);

	// 	expect(getRes).to.have.property("status", 200);

	// 	expect(getRes).to.have.deep.property("body", {
	// 		id: "upload_1",
	// 		status: "processing",
	// 		kind: "course_offerings",
	// 		stats: {
	// 			files_total: 0,
	// 			files_processed: 0,
	// 			files_skipped: 0,
	// 			courses_seen: 0,
	// 			courses_added: 0,
	// 			courses_modified: 0,
	// 			sections_seen: 0,
	// 			sections_added: 0,
	// 			sections_modified: 0,
	// 		},
	// 		message: "Processing in progress",
	// 	});
	// });

	it("13b: GET /api/v2/datasets/{id} should respond with status 200: Completed", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "test_12a.zip"));
		await request(app)
			.post("/api/v2/datasets")
			.field("kind", "course_offerings")
			.attach("archive", datasetBuffer, "courses.zip");

		const getRes = await waitForGetCompletion("upload_1");

		expect(getRes).to.have.property("status", 200);

		expect(getRes).to.have.deep.property("body", {
			id: "upload_1",
			status: "completed",
			kind: "course_offerings",
			stats: {
				files_total: 2,
				files_processed: 1,
				files_skipped: 1,
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

	it("13c: GET /api/v2/datasets/{id} should respond with status 200: Failed - Invalid ZIP", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "txtfile.txt"));
		const uploadRes = await request(app)
			.post("/api/v2/datasets")
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

	it("13d: GET /api/v2/datasets/{id} should respond with status 200: Failed - Missing Root", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "wrongfolder.zip"));
		const uploadRes = await request(app)
			.post("/api/v2/datasets")
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

	it("13e: GET /api/v2/datasets/{id} should respond with status 404: Not Found", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "test_12a.zip"));
		const uploadRes = await request(app)
			.post("/api/v2/datasets")
			.field("kind", "course_offerings")
			.attach("archive", datasetBuffer, "courses.zip");

		const getRes = await request(app).get("/api/v2/datasets/upload_2");

		expect(getRes).to.have.property("status", 404);

		expect(getRes).to.have.deep.property("body", {
			error: "Not found",
			message: "no dataset with id 'upload_2'",
		});
	});

	it("13f: One file - Update", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "cpsc",
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

		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "test_13f.zip"));
		await request(app)
			.post("/api/v2/datasets")
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
				courses_added: 0,
				courses_modified: 1,
				sections_seen: 1,
				sections_added: 0,
				sections_modified: 1,
			},
			message: "Dataset processing complete",
		});

		const resCourse = await request(app).get("/api/v1/courses/cpsc310");
		expect(resCourse).to.have.property("status", OK);
		expect(resCourse).to.have.deep.property("body", {
			title: "me2",
			dept: "cpsc",
			code: "310",
			id: "cpsc310",
			links: {
				sections: "/api/v1/courses/cpsc310/sections",
				self: "/api/v1/courses/cpsc310",
			},
		});

		const resSection = await request(app).get("/api/v1/courses/cpsc310/sections/21w201");
		expect(resSection).to.have.property("status", OK);
		expect(resSection).to.have.deep.property("body", {
			instructor: "me",
			year: 2022,
			avg: 1,
			pass: 2,
			fail: 3,
			audit: 4,
			id: "21w201",
			links: {
				course: "/api/v1/courses/cpsc310",
				self: "/api/v1/courses/cpsc310/sections/21w201",
			},
		});
	});

	it("13g: One file - No Update", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction",
			dept: "cpsc",
			code: "310",
		});

		await request(app).put("/api/v1/courses/cpsc310/sections/21w201").send({
			instructor: "me",
			year: 2022,
			avg: 1,
			pass: 2,
			fail: 3,
			audit: 4,
		});

		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "test_13f.zip"));
		await request(app)
			.post("/api/v2/datasets")
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
				courses_added: 0,
				courses_modified: 0,
				sections_seen: 1,
				sections_added: 0,
				sections_modified: 0,
			},
			message: "Dataset processing complete",
		});

		const resCourse = await request(app).get("/api/v1/courses/cpsc310");
		expect(resCourse).to.have.property("status", OK);
		expect(resCourse).to.have.deep.property("body", {
			title: "Introduction",
			dept: "cpsc",
			code: "310",
			id: "cpsc310",
			links: {
				sections: "/api/v1/courses/cpsc310/sections",
				self: "/api/v1/courses/cpsc310",
			},
		});

		const resSection = await request(app).get("/api/v1/courses/cpsc310/sections/21w201");
		expect(resSection).to.have.property("status", OK);
		expect(resSection).to.have.deep.property("body", {
			instructor: "me",
			year: 2022,
			avg: 1,
			pass: 2,
			fail: 3,
			audit: 4,
			id: "21w201",
			links: {
				course: "/api/v1/courses/cpsc310",
				self: "/api/v1/courses/cpsc310/sections/21w201",
			},
		});
	});

	it("14a: Case: Provided File", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "pair.zip"));
		await request(app)
			.post("/api/v2/datasets")
			.field("kind", "course_offerings")
			.attach("archive", datasetBuffer, "courses.zip");

		const getRes = await waitForGetCompletion("upload_1");

		expect(getRes).to.have.property("status", 200);

		expect(getRes).to.have.deep.property("body", {
			id: "upload_1",
			status: "completed",
			kind: "course_offerings",
			stats: {
				files_total: 5944,
				files_processed: 5944,
				files_skipped: 0,
				courses_seen: 3589,
				courses_added: 3589,
				courses_modified: 0,
				sections_seen: 64612,
				sections_added: 64612,
				sections_modified: 0,
			},
			message: "Dataset processing complete",
		});
	});

	it("14b: Case: Provided File 2x", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "pair.zip"));
		await request(app)
			.post("/api/v2/datasets")
			.field("kind", "course_offerings")
			.attach("archive", datasetBuffer, "courses.zip");

		await waitForGetCompletion("upload_1");
		await request(app)
			.post("/api/v2/datasets")
			.field("kind", "course_offerings")
			.attach("archive", datasetBuffer, "courses.zip");

		const getRes = await waitForGetCompletion("upload_2");

		expect(getRes).to.have.property("status", 200);

		expect(getRes).to.have.deep.property("body", {
			id: "upload_2",
			status: "completed",
			kind: "course_offerings",
			stats: {
				files_total: 5944,
				files_processed: 5944,
				files_skipped: 0,
				courses_seen: 3589,
				courses_added: 0,
				courses_modified: 0,
				sections_seen: 64612,
				sections_added: 0,
				sections_modified: 0,
			},
			message: "Dataset processing complete",
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
	it("18: GET /api/v1/courses/cpsc310/sections/ should respond with status OK and body 1 course and descriptors for given properties", async () => {
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
		expect(res).to.have.deep.property("body", [{ dept: "Asian Studies", avg: 96 }]);
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

		// Verify the data matches your example
		expect(res.body).to.deep.equal([
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

		// Verify the data matches your example
		expect(res.body).to.deep.equal([
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
		expect(res2.body).to.deep.equal([
			{ dept: "American Studies", avg: 54 },
			{ dept: "Asian Studies", avg: 95 },
			{ dept: "Asian Studies", avg: 96 },
		]);
	});
	it("28: GET /api/v1/courses with pagination should respond with status OK and body courses", async () => {
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
		expect(res2).to.have.property("status", OK);
		expect(res2.body).to.deep.equal([
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
	it("31: GET /api/v1/courses should return results in stable order.", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc210").send({
			title: "Software Construction",
			dept: "Computer Science",
			code: "210",
		});

		const res = await request(app).get("/api/v1/courses");

		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 2,
			limit: 100,
			offset: 0,
			items: [
				{
					id: "cpsc210",
					title: "Software Construction",
					dept: "Computer Science",
					code: "210",
					links: {
						self: "/api/v1/courses/cpsc210",
						sections: `/api/v1/courses/cpsc210/sections`,
					},
				},
				{
					id: "cpsc310",
					title: "Introduction to Software Engineering",
					dept: "Computer Science",
					code: "310",
					links: {
						self: "/api/v1/courses/cpsc310",
						sections: `/api/v1/courses/cpsc310/sections`,
					},
				},
			],
		});
	});
	it("32: GET /api/v1/courses should return results in stable order.", async () => {
		await request(app).put("/api/v1/courses/cpsc210").send({
			title: "Software Construction",
			dept: "Computer Science",
			code: "210",
		});
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).get("/api/v1/courses");

		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 2,
			limit: 100,
			offset: 0,
			items: [
				{
					id: "cpsc210",
					title: "Software Construction",
					dept: "Computer Science",
					code: "210",
					links: {
						self: "/api/v1/courses/cpsc210",
						sections: `/api/v1/courses/cpsc210/sections`,
					},
				},
				{
					id: "cpsc310",
					title: "Introduction to Software Engineering",
					dept: "Computer Science",
					code: "310",
					links: {
						self: "/api/v1/courses/cpsc310",
						sections: `/api/v1/courses/cpsc310/sections`,
					},
				},
			],
		});
	});
	it("33: GET /api/v1/courses should return results in stable order w pagination.", async () => {
		await request(app).put("/api/v1/courses/cpsc210").send({
			title: "Software Construction",
			dept: "Computer Science",
			code: "210",
		});
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/courses/weeb123").send({
			title: "Introduction to Asian Media",
			dept: "Asian Studies",
			code: "123",
		});

		const res = await request(app).get("/api/v1/courses?limit=1&offset=1");

		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 3,
			limit: 1,
			offset: 1,
			items: [
				{
					id: "cpsc310",
					title: "Introduction to Software Engineering",
					dept: "Computer Science",
					code: "310",
					links: {
						self: "/api/v1/courses/cpsc310",
						sections: `/api/v1/courses/cpsc310/sections`,
					},
				},
			],
		});
	});
	it("34: GET /api/v1/courses/{course} should respond with status OK and body course data", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).get("/api/v1/courses/cpsc310");
		expect(res).to.have.property("status", OK);
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
	it("35: GET /api/v1/courses/{course}/sections/2021w1 should respond with status OK and body section data", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Sciences",
			code: "310",
		});
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put(`/api/v1/courses/cpsc310/sections/2021w1`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 54,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		const res = await request(app).get("/api/v1/courses/cpsc310");
		expect(res).to.have.property("status", OK);
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
		const res2 = await request(app).get("/api/v1/courses/cpsc310/sections/2021w1");
		expect(res2).to.have.property("status", OK);
		expect(res2).to.have.deep.property("body", {
			id: "2021w1",
			instructor: "holmes, reid",
			year: 2021,
			avg: 54,
			pass: 167,
			fail: 3,
			audit: 1,
			links: {
				self: `/api/v1/courses/cpsc310/sections/2021w1`,
				course: "/api/v1/courses/cpsc310",
			},
		});
	});
	it("36: GET /api/v2/buildings should respond with status OK and body empty array and descriptors", async () => {
		// IN CLASS EXAMPLE
		const res = await request(app).get("/api/v2/buildings");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			total: 0,
			limit: 100,
			offset: 0,
			items: [],
		});
	});
	it("37: PUT /api/v2/buildings/{building} should respond with status CREATED and body building data", async () => {
		const res = await request(app).put("/api/v2/buildings/dmp").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		expect(res).to.have.property("status", CREATED);
		expect(res).to.have.deep.property("body", {
			id: "dmp",
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
			links: {
				self: "/api/v2/buildings/dmp",
				rooms: "/api/v2/buildings/dmp/rooms",
			},
		});
	});
	it("38: PUT /api/v2/buildings/{building} should respond with status 204", async () => {
		// potential tests required for missing params when updating?
		await request(app).put("/api/v2/buildings/dmp").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		const res = await request(app).put("/api/v2/buildings/dmp").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26123,
			lon: -123.24807,
		});

		expect(res).to.have.property("status", NO_CONTENT);
		expect(res).to.have.deep.property("body", {});
	});
	it("39: DEL /api/v2/buildings/{building} should respond with status 200 and body course data", async () => {
		await request(app).put("/api/v2/buildings/dmp").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		const res = await request(app).del("/api/v2/buildings/dmp");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			id: "dmp",
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
			rooms: 0,
		});
	});
	it("40: PUT /api/v2/buildings/{building} should respond with status 422", async () => {
		const res = await request(app).put("/api/v2/buildings/dmp").send({
			address: 2,
			lat: "3",
		});
		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				name: "required but missing",
				address: "expected a string",
				lat: "expected a number",
				lon: "required but missing",
			},
		});
	});
	it("41: PUT /api/v2/buildings/{building}/rooms/{room} should respond with status CREATED and body room data", async () => {
		await request(app).put("/api/v2/buildings/dmp").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		const res = await request(app).put("/api/v2/buildings/dmp/rooms/dmp101").send({
			building: "dmp",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Movable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});

		expect(res).to.have.property("status", CREATED);
		expect(res).to.have.deep.property("body", {
			id: "dmp101",
			building: "dmp",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Movable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
			links: {
				self: "/api/v2/buildings/dmp/rooms/dmp101",
				building: "/api/v2/buildings/dmp",
			},
		});
	});
	// Start of AI tests
	it("42: PUT should overwrite existing room", async () => {
		await request(app).put("/api/v2/buildings/dmp").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		await request(app).put("/api/v2/buildings/dmp/rooms/dmp101").send({
			building: "dmp",
			number: "101",
			type: "Lecture Theatre",
			furniture: "Fixed Tables",
			href: "test",
			seats: 80,
		});

		const res = await request(app).put("/api/v2/buildings/dmp/rooms/dmp101").send({
			building: "dmp",
			number: "101",
			type: "Lecture Theatre",
			furniture: "Fixed Tables",
			href: "test",
			seats: 100,
		});

		expect(res).to.have.property("status", NO_CONTENT);
		expect(res).to.have.deep.property("body", {});
	});
	it("43: PUT should reject invalid room body", async () => {
		await request(app).put("/api/v2/buildings/dmp").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		const res = await request(app).put("/api/v2/buildings/dmp/rooms/dmp101").send({
			number: 101,
			type: 123,
			furniture: null,
			href: 5,
			seats: -1,
		});

		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: {
				building: "required but missing",
				number: "expected a string",
				type: "expected a string",
				furniture: "expected a string",
				href: "expected a string",
				seats: "expected a number >= 0",
			},
		});
	});
	it("44: GET /api/v2/buildings/{building}/rooms/{room} should respond with status OK and body room data", async () => {
		await request(app).put("/api/v2/buildings/dmp").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		await request(app).put("/api/v2/buildings/dmp/rooms/dmp101").send({
			building: "dmp",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Movable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});
		const res = await request(app).get("/api/v2/buildings/dmp/rooms/dmp101");

		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			id: "dmp101",
			building: "dmp",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Movable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
			links: {
				self: "/api/v2/buildings/dmp/rooms/dmp101",
				building: "/api/v2/buildings/dmp",
			},
		});
	});
	it("45: DELETE /api/v2/buildings/{building}/rooms/{room} should respond with status OK and body room data", async () => {
		await request(app).put("/api/v2/buildings/dmp").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		await request(app).put("/api/v2/buildings/dmp/rooms/dmp101").send({
			building: "dmp",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Movable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});
		const res = await request(app).delete("/api/v2/buildings/dmp/rooms/dmp101");

		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			id: "dmp101",
			building: "dmp",
			number: "101",
			type: "Open Design General Purpose",
			furniture: "Classroom-Movable Tables & Chairs",
			href: "http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101",
			seats: 40,
		});
	});

	it("46: POST /api/v2/search should respond with status OK and body results", async () => {
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
			.post("/api/v2/search")
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
		expect(res2).to.have.property("status", OK);
		expect(res2.body).to.deep.equal([
			{ dept: "DOOM", avg: 50 },
			{ dept: "American Studies", avg: 54 },
			{ dept: "DOOM", avg: 54 },
			{ dept: "Asian Studies", avg: 95 },
			{ dept: "Asian Studies", avg: 96 },
		]);
	});
	// Generated by AI
	it("47: POST /api/v2/search should respond with status OK and body facility results", async () => {
		// Setup Buildings
		await request(app).put("/api/v2/buildings/dmp").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		await request(app).put("/api/v2/buildings/orch").send({
			name: "Orchard Commons",
			address: "6363 Agronomy Road V6T 1Z4",
			lat: 49.26044,
			lon: -123.2501,
		});

		// Setup Rooms
		await request(app).put("/api/v2/buildings/dmp/rooms/dmp101").send({
			building: "Hugh Dempster Pavilion",
			number: "101",
			type: "Small Room",
			furniture: "Classroom-Movable Tables & Chairs",
			href: "http://test.com/dmp101",
			seats: 40,
		});
		await request(app).put("/api/v2/buildings/dmp/rooms/dmp301").send({
			building: "Hugh Dempster Pavilion",
			number: "301",
			type: "Lecture Theatre",
			furniture: "Classroom-Fixed Tables & Chairs",
			href: "http://test.com/dmp301",
			seats: 120,
		});
		await request(app).put("/api/v2/buildings/orch/rooms/orch1001").send({
			building: "Orchard Commons",
			number: "1001",
			type: "Lecture Theatre",
			furniture: "Classroom-Movable Tables & Chairs",
			href: "http://test.com/orch1001",
			seats: 250,
		});

		// Perform Search
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: {
						GT: { seats: 100 },
					},
					OPTIONS: {
						COLUMNS: ["building", "seats", "type"],
						ORDER: "seats",
					},
				},
			});

		// Assertions
		expect(res).to.have.property("status", OK);
		expect(res.body).to.deep.equal([
			{ building: "Hugh Dempster Pavilion", seats: 120, type: "Lecture Theatre" },
			{ building: "Orchard Commons", seats: 250, type: "Lecture Theatre" },
		]);
	});

	it("48: POST /api/v2/search should respond with status OK and body facility results with TRANSFORMATIONS", async () => {
		// Setup Buildings
		await request(app).put("/api/v2/buildings/dmp").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		// Setup Rooms
		await request(app).put("/api/v2/buildings/dmp/rooms/dmp101").send({
			building: "Hugh Dempster Pavilion",
			number: "101",
			type: "Small Room",
			furniture: "Movable Tables & Chairs",
			href: "http://test.com/dmp101",
			seats: 40,
		});
		await request(app).put("/api/v2/buildings/dmp/rooms/dmp102").send({
			building: "Hugh Dempster Pavilion",
			number: "102",
			type: "Small Room",
			furniture: "Movable Tables & Chairs",
			href: "http://test.com/dmp102",
			seats: 60,
		});
		await request(app).put("/api/v2/buildings/dmp/rooms/dmp301").send({
			building: "Hugh Dempster Pavilion",
			number: "301",
			type: "Lecture Theatre",
			furniture: "Fixed Tables",
			href: "http://test.com/dmp301",
			seats: 120,
		});

		// Perform Search with GROUP and APPLY
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: {
						IS: { building: "Hugh*" },
					},
					OPTIONS: {
						COLUMNS: ["type", "totalSeats", "maxSeats"],
						ORDER: {
							dir: "UP",
							keys: ["totalSeats"],
						},
					},
					TRANSFORMATIONS: {
						GROUP: ["type"],
						APPLY: [{ totalSeats: { SUM: "seats" } }, { maxSeats: { MAX: "seats" } }],
					},
				},
			});

		// Assertions
		expect(res).to.have.property("status", OK);
		expect(res.body).to.deep.equal([
			{ type: "Small Room", totalSeats: 100, maxSeats: 60 },
			{ type: "Lecture Theatre", totalSeats: 120, maxSeats: 120 },
		]);
	});
	it("49: POST /api/v2/search should respond with 400 if TRANSFORMATIONS is missing GROUP", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: {
						GT: { seats: 0 },
					},
					OPTIONS: {
						COLUMNS: ["maxSeats"],
						ORDER: "maxSeats",
					},
					TRANSFORMATIONS: {
						// GROUP is missing
						APPLY: [{ maxSeats: { MAX: "seats" } }],
					},
				},
			});

		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "Missing GROUP in TRANSFORMATIONS",
		});
	});

	it("50: POST /api/v2/search should respond with 400 if COLUMNS are not present in GROUP or APPLY", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: {
						GT: { seats: 0 },
					},
					OPTIONS: {
						COLUMNS: ["type", "maxSeats", "href"], // 'href' is not grouped or applied
						ORDER: "maxSeats",
					},
					TRANSFORMATIONS: {
						GROUP: ["type"],
						APPLY: [{ maxSeats: { MAX: "seats" } }],
					},
				},
			});

		expect(res).to.have.property("status", 400);
		expect(res).to.have.deep.property("body", {
			error: "Invalid query",
			message: "When TRANSFORMATIONS is present, all COLUMNS must be in GROUP or APPLY",
		});
	});

	it("51: POST /api/v2/search should respond with 200 and an empty array if WHERE filters out all results before TRANSFORMATIONS", async () => {
		// Setup Building and Room
		await request(app).put("/api/v2/buildings/dmp").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});
		await request(app).put("/api/v2/buildings/dmp/rooms/dmp101").send({
			building: "Hugh Dempster Pavilion",
			number: "101",
			type: "Small Room",
			furniture: "Movable Tables & Chairs",
			href: "http://test.com/dmp101",
			seats: 40,
		});

		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: {
						GT: { seats: 9000 }, // Should filter out everything
					},
					OPTIONS: {
						COLUMNS: ["type", "totalSeats"],
						ORDER: "totalSeats",
					},
					TRANSFORMATIONS: {
						GROUP: ["type"],
						APPLY: [{ totalSeats: { SUM: "seats" } }],
					},
				},
			});

		expect(res).to.have.property("status", OK);
		expect(res.body).to.deep.equal([]);
	});

	it("52: POST /api/v2/search should apply complex WHERE filters (AND/OR) correctly before grouping", async () => {
		// Setup Building
		await request(app).put("/api/v2/buildings/dmp").send({
			name: "Hugh Dempster Pavilion",
			address: "6245 Agronomy Road V6T 1Z4",
			lat: 49.26125,
			lon: -123.24807,
		});

		// Setup Rooms
		await request(app).put("/api/v2/buildings/dmp/rooms/dmp101").send({
			building: "Hugh Dempster Pavilion",
			number: "101",
			type: "Small Room",
			furniture: "Movable",
			href: "test1",
			seats: 40,
		});
		await request(app).put("/api/v2/buildings/dmp/rooms/dmp102").send({
			building: "Hugh Dempster Pavilion",
			number: "102",
			type: "Small Room",
			furniture: "Fixed", // We will filter this out
			href: "test2",
			seats: 60,
		});
		await request(app).put("/api/v2/buildings/dmp/rooms/dmp301").send({
			building: "Hugh Dempster Pavilion",
			number: "301",
			type: "Lecture Theatre",
			furniture: "Movable",
			href: "test3",
			seats: 120,
		});

		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: {
						AND: [
							{ IS: { building: "Hugh*" } },
							{ IS: { furniture: "Movable" } }, // Eliminates room dmp102 (60 seats)
						],
					},
					OPTIONS: {
						COLUMNS: ["type", "totalSeats"],
						ORDER: {
							dir: "DOWN",
							keys: ["totalSeats"],
						},
					},
					TRANSFORMATIONS: {
						GROUP: ["type"],
						APPLY: [{ totalSeats: { SUM: "seats" } }],
					},
				},
			});

		expect(res).to.have.property("status", OK);
		// Small Room should only sum dmp101 (40), not dmp102 (60)
		expect(res.body).to.deep.equal([
			{ type: "Lecture Theatre", totalSeats: 120 },
			{ type: "Small Room", totalSeats: 40 },
		]);
	});
	it("53: POST /api/v2/search should respond with 400 if applykey contains an underscore", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: {},
					OPTIONS: {
						COLUMNS: ["building", "max_seats"],
					},
					TRANSFORMATIONS: {
						GROUP: ["building"],
						APPLY: [
							{ max_seats: { MAX: "seats" } }, // Underscores are illegal in EBNF [^_]+
						],
					},
				},
			});

		expect(res).to.have.property("status", 400);
		expect(res.body.message).to.include("applykey cannot contain underscores");
	});

	it("54: POST /api/v2/search should respond with 400 if APPLY contains duplicate applykeys", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: {},
					OPTIONS: {
						COLUMNS: ["building", "seatMetric"],
					},
					TRANSFORMATIONS: {
						GROUP: ["building"],
						APPLY: [
							{ seatMetric: { MAX: "seats" } },
							{ seatMetric: { MIN: "seats" } }, // Duplicate key is illegal
						],
					},
				},
			});

		expect(res).to.have.property("status", 400);
		expect(res.body.message).to.include("Duplicate applykey found");
	});

	it("55: POST /api/v2/search should respond with 400 if MAX/MIN/AVG/SUM targets an sfield (string)", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: {},
					OPTIONS: {
						COLUMNS: ["building", "maxType"],
					},
					TRANSFORMATIONS: {
						GROUP: ["building"],
						APPLY: [
							{ maxType: { MAX: "type" } }, // 'type' is a string, MAX requires a numeric mfield
						],
					},
				},
			});

		expect(res).to.have.property("status", 400);
		expect(res.body.message).to.include("must target a numeric field");
	});

	it("56: POST /api/v2/search should respond with 400 if ORDER keys are not present in COLUMNS", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: {
						GT: { seats: 100 },
					},
					OPTIONS: {
						COLUMNS: ["building", "type"], // 'seats' is missing here
						ORDER: {
							dir: "UP",
							keys: ["seats"], // Illegal because it's not in COLUMNS
						},
					},
				},
			});

		expect(res).to.have.property("status", 400);
		expect(res.body.message).to.include("must be in COLUMNS");
	});

	it("57: POST /api/v2/search should respond with 400 if fields from different datasets are mixed", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities", // Dataset is facilities
				query: {
					WHERE: {
						GT: { avg: 90 }, // 'avg' belongs to course_offerings
					},
					OPTIONS: {
						COLUMNS: ["building", "seats"],
						ORDER: "seats",
					},
				},
			});

		expect(res).to.have.property("status", 400);
		expect(res.body.message).to.include("targets an invalid mfield");
	});

	it("58: POST /api/v2/search should respond with 400 if a FILTER object has more than one key", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: {
						// Illegal: Two keys (GT and LT) inside the same logic block instead of inside an AND array
						GT: { seats: 50 },
						LT: { seats: 200 },
					},
					OPTIONS: {
						COLUMNS: ["building", "seats"],
					},
				},
			});

		expect(res).to.have.property("status", 400);
		expect(res.body.message).to.include("must contain exactly one key");
	});

	it("59: POST /api/v2/search should respond with 400 if IS contains an asterisk in the middle of the string", async () => {
		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: {
						IS: { building: "Hugh*Pavilion" }, // Illegal wildcard placement
					},
					OPTIONS: {
						COLUMNS: ["building", "seats"],
					},
				},
			});

		expect(res).to.have.property("status", 400);
		expect(res.body.message).to.include("asterisks can only be the first or last character");
	});
	// End of AI Code
	it("60: DELETE /api/v1/courses/{course} should respond with status OK and body course data", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put(`/api/v1/courses/cpsc310/sections/2021w1`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 54,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).put(`/api/v1/courses/cpsc310/sections/2021w2`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 54,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		const res = await request(app).delete("/api/v1/courses/cpsc310");

		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			id: "cpsc310",
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
			sections: 2,
		});
	});
	// Start of AI Code
	it("61: POST /api/v2/search should not leak unrequested GROUP keys into the final projection (Column Leak Bug)", async () => {
		// Setup Building
		await request(app).put("/api/v2/buildings/alrd").send({
			name: "Allard Hall",
			address: "1822 East Mall",
			lat: 49.2699,
			lon: -123.25318,
		});

		// Setup Rooms
		await request(app).put("/api/v2/buildings/alrd/rooms/105").send({
			building: "ALRD",
			number: "105",
			type: "Tiered Large",
			furniture: "Classroom-Fixed Tables",
			href: "test_url",
			seats: 100,
		});
		await request(app).put("/api/v2/buildings/alrd/rooms/106").send({
			building: "ALRD",
			number: "106",
			type: "Tiered Large",
			furniture: "Classroom-Fixed Tables",
			href: "test_url",
			seats: 50,
		});

		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "facilities",
				query: {
					WHERE: { IS: { building: "ALRD" } },
					OPTIONS: { COLUMNS: ["building", "totalSeats"] }, // Requesting ONLY 2 columns
					TRANSFORMATIONS: {
						GROUP: ["building", "type", "furniture"], // Grouping by 3 columns
						APPLY: [{ totalSeats: { SUM: "seats" } }],
					},
				},
			});

		expect(res.status).to.equal(OK);

		// The 'type' and 'furniture' keys MUST NOT be present in the final output
		expect(res.body).to.deep.equal([{ building: "ALRD", totalSeats: 150 }]);
	});

	it("62: POST /api/v2/search should correctly calculate aggregations without IEEE 754 precision drift", async () => {
		// Setup a course with specific averages that naturally cause float drift in standard JS
		await request(app).put("/api/v1/courses/math100").send({
			title: "Calculus I",
			dept: "math",
			code: "100",
		});

		// 90.10 + 90.20 + 90.20 = 270.50 / 3 = 90.1666666...
		// Properly rounded using Decimal.js should exactly equal 90.17
		await request(app)
			.put("/api/v1/courses/math100/sections/s1")
			.send({ instructor: "A", year: 2014, avg: 90.1, pass: 1, fail: 0, audit: 0 });
		await request(app)
			.put("/api/v1/courses/math100/sections/s2")
			.send({ instructor: "B", year: 2014, avg: 90.2, pass: 1, fail: 0, audit: 0 });
		await request(app)
			.put("/api/v1/courses/math100/sections/s3")
			.send({ instructor: "C", year: 2014, avg: 90.2, pass: 1, fail: 0, audit: 0 });

		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: { EQ: { year: 2014 } },
					OPTIONS: { COLUMNS: ["dept", "average"] },
					TRANSFORMATIONS: {
						GROUP: ["dept"],
						APPLY: [{ average: { AVG: "avg" } }],
					},
				},
			});

		expect(res.status).to.equal(OK);
		expect(res.body).to.deep.equal([{ dept: "math", average: 90.17 }]);
	});

	it("63: POST /api/v2/search should not collapse distinct groups with colliding group keys", async () => {
		// Setup Course 1
		await request(app).put("/api/v1/courses/c1").send({
			title: "Test Course 1",
			dept: "cpsc",
			code: "1",
		});
		await request(app).put("/api/v1/courses/c1/sections/s1").send({
			instructor: "john|doe", // Edge case instructor name
			year: 2020,
			avg: 90,
			pass: 1,
			fail: 0,
			audit: 0,
		});

		// Setup Course 2
		await request(app).put("/api/v1/courses/c2").send({
			title: "Test Course 2",
			dept: "cpsc|john", // Edge case dept name
			code: "2",
		});
		await request(app).put("/api/v1/courses/c2/sections/s1").send({
			instructor: "doe",
			year: 2020,
			avg: 80,
			pass: 1,
			fail: 0,
			audit: 0,
		});

		const res = await request(app)
			.post("/api/v2/search")
			.send({
				kind: "course_offerings",
				query: {
					WHERE: {},
					OPTIONS: {
						COLUMNS: ["dept", "instructor", "count"],
					},
					TRANSFORMATIONS: {
						GROUP: ["dept", "instructor"],
						APPLY: [{ count: { COUNT: "avg" } }],
					},
				},
			});

		expect(res.status).to.equal(OK);

		// Naive joining (e.g., `dept + "|" + instructor`) would result in a single group "cpsc|john|doe" with a count of 2.
		// The new system should correctly recognize these as two separate groups of 1.
		expect(res.body).to.have.lengthOf(2);
		expect(res.body).to.have.deep.members([
			{ dept: "cpsc", instructor: "john|doe", count: 1 },
			{ dept: "cpsc|john", instructor: "doe", count: 1 },
		]);
	});
	// End of AI Code
	it("64: GET /api/v1/courses/{course} should return 404 for deleted course", async () => {
		await request(app).put("/api/v1/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put(`/api/v1/courses/cpsc310/sections/2021w1`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 54,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).put(`/api/v1/courses/cpsc310/sections/2021w2`).send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 54,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).delete("/api/v1/courses/cpsc310");
		const res = await request(app).get(`/api/v1/courses/cpsc310/sections/2021w2`);
		expect(res).to.have.property("status", NOT_FOUND);
		const res2 = await request(app).get(`/api/v1/courses/cpsc310/`);
		expect(res2).to.have.property("status", NOT_FOUND);
	});

	it("65: Case: Provided File (facilities)", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "campus.zip"));
		await request(app)
			.post("/api/v2/datasets")
			.field("kind", "facilities")
			.attach("archive", datasetBuffer, "campus.zip");

		const getRes = await waitForGetCompletion("upload_1");

		expect(getRes).to.have.property("status", 200);

		expect(getRes).to.have.deep.property("body", {
			id: "upload_1",
			status: "completed",
			kind: "facilities",
			stats: {
				buildings_added: 74,
				buildings_modified: 0,
				rooms_added: 363,
				rooms_modified: 0,
			},
			message: "Dataset processing complete",
		});
	});

	it("60b: Case: Provided File 2x", async () => {
		const datasetBuffer = await fs.readFile(path.resolve(__dirname, "campus.zip"));
		await request(app)
			.post("/api/v2/datasets")
			.field("kind", "facilities")
			.attach("archive", datasetBuffer, "campus.zip");

		await waitForGetCompletion("upload_1");
		await request(app)
			.post("/api/v2/datasets")
			.field("kind", "facilities")
			.attach("archive", datasetBuffer, "campus.zip");

		const getRes = await waitForGetCompletion("upload_2");

		expect(getRes).to.have.property("status", 200);

		expect(getRes).to.have.deep.property("body", {
			id: "upload_2",
			status: "completed",
			kind: "facilities",
			stats: {
				buildings_added: 0,
				buildings_modified: 0,
				rooms_added: 0,
				rooms_modified: 0,
			},
			message: "Dataset processing complete",
		});
	});
});
