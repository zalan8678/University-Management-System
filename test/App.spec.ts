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

	it("1a: GET /api/v1/orgs should respond with status OK and body empty array", async () => {
		// IN CLASS EXAMPLE
		const res = await request(app).get("/api/v1/orgs");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", []);
	});

	it("1b: GET /api/v1/orgs should respond with status OK and body org data", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		await request(app).put("/api/v1/orgs/sfu").send({ name: "SFU" });
		const res = await request(app).get("/api/v1/orgs");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", [
			{ id: "ubc", name: "UBC", links: { self: "/api/v1/orgs/ubc", courses: [] } },
			{ id: "sfu", name: "SFU", links: { self: "/api/v1/orgs/sfu", courses: [] } },
		]);
	});

	it("2a: GET /api/v1/orgs/{org} should respond with status OK and body one org", async () => {
		// IN CLASS EXAMPLE
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		const res = await request(app).get("/api/v1/orgs/ubc");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			id: "ubc",
			name: "UBC",
			links: {
				self: "/api/v1/orgs/ubc",
				courses: [],
			},
		});
	});

	it("2b: GET /api/v1/orgs/{org} should respond with status 404", async () => {
		const res = await request(app).get("/api/v1/orgs/ubc");
		expect(res).to.have.property("status", NOT_FOUND);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no org with id 'ubc'",
		});
	});

	it("3a: PUT /api/v1/orgs/{org} should respond with status CREATED and body org data", async () => {
		// IN CLASS EXAMPLE
		const res = await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		expect(res).to.have.property("status", CREATED);
		expect(res).to.have.deep.property("body", {
			id: "ubc",
			name: "UBC",
			links: { self: "/api/v1/orgs/ubc", courses: [] },
		});
	});

	it("3b: PUT /api/v1/orgs/{org} should respond with status 204", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		const res = await request(app).put("/api/v1/orgs/ubc").send({ name: "The University of British Columbia" });
		expect(res).to.have.property("status", NO_CONTENT);
		expect(res).to.have.deep.property("body", {});
	});

	it("3c: PUT /api/v1/orgs/{org} should respond with status 422", async () => {
		const res = await request(app).put("/api/v1/orgs/ubc").send({});
		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: { name: "required but missing" },
		});
	});

	it("4a: DEL /api/v1/orgs/{org} should respond with status 200 and body org data", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		const res = await request(app).del("/api/v1/orgs/ubc");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			id: "ubc",
			name: "UBC",
			courses: [],
		});
	});

	it("4b: DEL /api/v1/orgs/{org} should respond with status 404", async () => {
		const res = await request(app).del("/api/v1/orgs/ubc");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no org with id 'ubc'",
		});
	});

	it("5a: GET /api/v1/orgs/{org}/courses should respond with status OK and body empty array", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		const res = await request(app).get("/api/v1/orgs/ubc/courses");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", []);
	});

	it("5b: GET /api/v1/orgs/{org}/courses should respond with status OK and body one org", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		await request(app).put("/api/v1/orgs/ubc/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/orgs/ubc/courses/cpsc210").send({
			title: "Introduction to 210",
			dept: "Computer Science",
			code: "210",
		});

		const res = await request(app).get("/api/v1/orgs/ubc/courses");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", [
			{
				id: "cpsc310",
				title: "Introduction to Software Engineering",
				dept: "Computer Science",
				code: "310",
				links: {
					self: "/api/v1/orgs/ubc/courses/cpsc310",
					org: "/api/v1/orgs/ubc",
					sections: [],
				},
			},

			{
				id: "cpsc210",
				title: "Introduction to 210",
				dept: "Computer Science",
				code: "210",
				links: {
					self: "/api/v1/orgs/ubc/courses/cpsc210",
					org: "/api/v1/orgs/ubc",
					sections: [],
				},
			},
		]);
	});

	it("5c: GET /api/v1/orgs/{org}/courses should respond with status 404", async () => {
		const res = await request(app).get("/api/v1/orgs/ubc/courses");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no org with id 'ubc'",
		});
	});

	it("6a: GET /api/v1/orgs/{org}/courses/{course} should respond with status OK and body one course", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		await request(app).put("/api/v1/orgs/ubc/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		const res = await request(app).get("/api/v1/orgs/ubc/courses/cpsc310");
		expect(res).to.have.property("status", 200);
		expect(res).to.have.deep.property("body", {
			id: "cpsc310",
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
			links: {
				self: "/api/v1/orgs/ubc/courses/cpsc310",
				org: "/api/v1/orgs/ubc",
				sections: [],
			},
		});
	});

	it("6b: GET /api/v1/orgs/{org}/courses/{course} should respond with status 404: Org not found", async () => {
		const res = await request(app).get("/api/v1/orgs/ubc/courses/cpsc310");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no org with id 'ubc'",
		});
	});

	it("6c: GET /api/v1/orgs/{org}/courses/{course} should respond with status 404: Course not found", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		const res = await request(app).get("/api/v1/orgs/ubc/courses/cpsc310");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no course with id 'cpsc310'",
		});
	});

	it("7a: PUT /api/v1/orgs/{org}/courses/{course} should respond with status CREATED and body course data", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });

		const res = await request(app).put("/api/v1/orgs/ubc/courses/cpsc310").send({
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
				self: "/api/v1/orgs/ubc/courses/cpsc310",
				org: "/api/v1/orgs/ubc",
				sections: [],
			},
		});
	});

	it("7b: PUT /api/v1/orgs/{org}/courses/{course} should respond with status 204", async () => {
		// potential tests required for missing params when updating?
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		await request(app).put("/api/v1/orgs/ubc/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		const res = await request(app).put("/api/v1/orgs/ubc/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Biology",
			code: "310",
		});

		expect(res).to.have.property("status", NO_CONTENT);
		expect(res).to.have.deep.property("body", {});
	});

	it("7c: PUT /api/v1/orgs/{org}/courses/{course} should respond with status 404", async () => {
		const res = await request(app).put("/api/v1/orgs/ubc/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no org with id 'ubc'",
		});
	});

	it("7d: PUT /api/v1/orgs/{org}/courses/{course} should respond with status 422: Title Missing", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		const res = await request(app).put("/api/v1/orgs/ubc/courses/cpsc310").send({
			dept: "Computer Science",
			code: "310",
		});
		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: { title: "required but missing" },
		});
	});

	it("7e: PUT /api/v1/orgs/{org}/courses/{course} should respond with status 422: Department Missing", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		const res = await request(app).put("/api/v1/orgs/ubc/courses/cpsc310").send({
			title: "title",
			code: "310",
		});
		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: { dept: "required but missing" },
		});
	});

	it("7f: PUT /api/v1/orgs/{org}/courses/{course} should respond with status 422: Code Missing", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		const res = await request(app).put("/api/v1/orgs/ubc/courses/cpsc310").send({
			title: "title",
			dept: "Computer Science",
		});
		expect(res).to.have.property("status", 422);
		expect(res).to.have.deep.property("body", {
			error: "Validation failed",
			fields: { code: "required but missing" },
		});
	});

	it("8a: DEL /api/v1/orgs/{org}/courses/{course} should respond with status 200 and body org data", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		await request(app).put("/api/v1/orgs/ubc/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		const res = await request(app).del("/api/v1/orgs/ubc/courses/cpsc310");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			id: "cpsc310",
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
			sections: [],
		});
	});

	it("8b: DEL /api/v1/orgs/{org}/courses/{course} should respond with status 404: Org not found", async () => {
		const res = await request(app).del("/api/v1/orgs/ubc/courses/cpsc310");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no org with id 'ubc'",
		});
	});

	it("8c: DEL /api/v1/orgs/{org}/courses/{course} should respond with status 404 : Course not found", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		const res = await request(app).del("/api/v1/orgs/ubc/courses/cpsc310");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no course with id 'cpsc310'",
		});
	});

	it("9a: GET /api/v1/orgs/{org}/courses/{course}/sections should respond with status OK and body empty array", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		await request(app).put("/api/v1/orgs/ubc/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		const res = await request(app).get("/api/v1/orgs/ubc/courses/cpsc310/sections");

		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", []);
	});

	it("9b: GET /api/v1/orgs/{org}/courses/{course}/sections should respond with status OK and body sections", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		await request(app).put("/api/v1/orgs/ubc/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/orgs/ubc/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});
		await request(app).put("/api/v1/orgs/ubc/courses/cpsc310/sections/21w202").send({
			instructor: "norman",
			year: 2021,
			avg: 81.4,
			pass: 222,
			fail: 33,
			audit: 11,
		});

		const res = await request(app).get("/api/v1/orgs/ubc/courses/cpsc310/sections");
		expect(res).to.have.property("status", OK);

		expect(res).to.have.deep.property("body", [
			{
				id: "21w201",
				instructor: "holmes, reid",
				year: 2021,
				avg: 76.4,
				pass: 167,
				fail: 3,
				audit: 1,
				links: {
					self: "/api/v1/orgs/ubc/courses/cpsc310/sections/21w201",
					course: "/api/v1/orgs/ubc/courses/cpsc310",
				},
			},

			{
				id: "21w202",
				instructor: "norman",
				year: 2021,
				avg: 81.4,
				pass: 222,
				fail: 33,
				audit: 11,
				links: {
					self: "/api/v1/orgs/ubc/courses/cpsc310/sections/21w202",
					course: "/api/v1/orgs/ubc/courses/cpsc310",
				},
			},
		]);
	});

	it("9c: GET /api/v1/orgs/{org}/courses/{course}/sections should respond with status 404: Org not found", async () => {
		const res = await request(app).get("/api/v1/orgs/ubc/courses/cpsc310/sections");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no org with id 'ubc'",
		});
	});

	it("9d: GET /api/v1/orgs/{org}/courses/{course}/sections should respond with status 404: Course not found", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		const res = await request(app).get("/api/v1/orgs/ubc/courses/cpsc310/sections");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no course with id 'cpsc310'",
		});
	});

	it("10a: GET /api/v1/orgs/{org}/courses/{course}/sections/{section} should respond with status OK and body section data", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		await request(app).put("/api/v1/orgs/ubc/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		await request(app).put("/api/v1/orgs/ubc/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});

		const res = await request(app).get("/api/v1/orgs/ubc/courses/cpsc310/sections/21w201");
		expect(res).to.have.property("status", OK);
		expect(res).to.have.deep.property("body", {
			id: "21w201",
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
			links: {
				self: "/api/v1/orgs/ubc/courses/cpsc310/sections/21w201",
				course: "/api/v1/orgs/ubc/courses/cpsc310",
			},
		});
	});

	it("10b: GET /api/v1/orgs/{org}/courses/{course}/sections/{section} should respond with status 404: Org not found", async () => {
		const res = await request(app).get("/api/v1/orgs/ubc/courses/cpsc310/sections/21w201");

		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no org with id 'ubc'",
		});
	});

	it("10c: GET /api/v1/orgs/{org}/courses/{course}/sections/{section} should respond with status 404: Course not found", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		const res = await request(app).get("/api/v1/orgs/ubc/courses/cpsc310/sections/21w201");

		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no course with id 'cpsc310'",
		});
	});

	it("10d: GET /api/v1/orgs/{org}/courses/{course}/sections/{section} should respond with status 404: Section not found", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		await request(app).put("/api/v1/orgs/ubc/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		const res = await request(app).get("/api/v1/orgs/ubc/courses/cpsc310/sections/21w201");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no section with id '21w201'",
		});
	});

	it("11a: PUT /api/v1/orgs/{org}/courses/{course}/sections/{section} should respond with status CREATED and body section data", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		await request(app).put("/api/v1/orgs/ubc/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		const res = await request(app).put("/api/v1/orgs/ubc/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});

		expect(res).to.have.property("status", CREATED);
		expect(res).to.have.deep.property("body", {
			id: "21w201",
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
			links: {
				self: "/api/v1/orgs/ubc/courses/cpsc310/sections/21w201",
				course: "/api/v1/orgs/ubc/courses/cpsc310",
			},
		});
	});

	it("11b: PUT /api/v1/orgs/{org}/courses/{course}/sections/{section} should respond with status 204", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		await request(app).put("/api/v1/orgs/ubc/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/orgs/ubc/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});

		const res = await request(app).put("/api/v1/orgs/ubc/courses/cpsc310/sections/21w201").send({
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

	it("11c: PUT /api/v1/orgs/{org}/courses/{course}/sections/{section} should respond with status 404: Org not found", async () => {
		const res = await request(app).put("/api/v1/orgs/ubc/courses/cpsc310/sections/21w201").send({
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
			message: "no org with id 'ubc'",
		});
	});

	it("11d: PUT /api/v1/orgs/{org}/courses/{course}/sections/{section} should respond with status 404: Course not found", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		await request(app).put("/api/v1/orgs/ubc/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).put("/api/v1/orgs/ubc/courses/cpsc310/sections/21w201").send({
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

	it("11e: PUT /api/v1/orgs/{org}/courses/{course}/sections/{section} should respond with status 422: required but missing", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		await request(app).put("/api/v1/orgs/ubc/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).put("/api/v1/orgs/ubc/courses/cpsc310/sections/21w201").send({});

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

	it("11f: PUT /api/v1/orgs/{org}/courses/{course}/sections/{section} should respond with status 422: lower bounds", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		await request(app).put("/api/v1/orgs/ubc/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).put("/api/v1/orgs/ubc/courses/cpsc310/sections/21w201").send({
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

	it("11g: PUT /api/v1/orgs/{org}/courses/{course}/sections/{section} should respond with status 422: upper bounds", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		await request(app).put("/api/v1/orgs/ubc/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		const res = await request(app).put("/api/v1/orgs/ubc/courses/cpsc310/sections/21w201").send({
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

	it("12a: DEL /api/v1/orgs/{org}/courses/{course}/sections/{section} should respond with status 200 and body section data", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		await request(app).put("/api/v1/orgs/ubc/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});
		await request(app).put("/api/v1/orgs/ubc/courses/cpsc310/sections/21w201").send({
			instructor: "holmes, reid",
			year: 2021,
			avg: 76.4,
			pass: 167,
			fail: 3,
			audit: 1,
		});

		const res = await request(app).del("/api/v1/orgs/ubc/courses/cpsc310/sections/21w201");
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

	it("12b: DEL /api/v1/orgs/{org}/courses/{course}/sections/{section} should respond with status 404: Org not found", async () => {
		const res = await request(app).del("/api/v1/orgs/ubc/courses/cpsc310/sections/21w201");

		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no org with id 'ubc'",
		});
	});

	it("12c: DEL /api/v1/orgs/{org}/courses/{course}/sections/{section} should respond with status 404: Course not found", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		const res = await request(app).del("/api/v1/orgs/ubc/courses/cpsc310/sections/21w201");

		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no course with id 'cpsc310'",
		});
	});

	it("12d: DEL /api/v1/orgs/{org}/courses/{course}/sections/{section} should respond with status 404: Section not found", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		await request(app).put("/api/v1/orgs/ubc/courses/cpsc310").send({
			title: "Introduction to Software Engineering",
			dept: "Computer Science",
			code: "310",
		});

		const res = await request(app).del("/api/v1/orgs/ubc/courses/cpsc310/sections/21w201");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no section with id '21w201'",
		});
	});
});
