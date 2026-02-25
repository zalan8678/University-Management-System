import fs from "fs/promises";
import { expect } from "chai";
import request from "supertest";
import { StatusCodes } from "http-status-codes";
import { Application, createApp } from "../src/App";

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

	it("7: PUT /api/v1/orgs/{org}/courses/{course} should respond with status 204", async () => {
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
	it("8: PUT /api/v1/orgs/{org}/courses/{course} should respond with status 422: Code Missing", async () => {
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

	it("9: DEL /api/v1/courses/{course} should respond with status 200 and body org data", async () => {
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
	it("11: GET /api/v1/orgs/{org}/courses/{course}/sections should respond with status OK and body params and empty array", async () => {
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
});
