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
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
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
		const res = await request(app).get("/api/v1/orgs/ubc/courses/CPSC100");
		expect(res).to.have.property("status", 404);
		expect(res).to.have.deep.property("body", {
			error: "Not found",
			message: "no course with id 'CPSC100'",
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

	it("7d: PUT /api/v1/orgs/{org}/courses/{course} should respond with status 404", async () => {
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

	it("7e: PUT /api/v1/orgs/{org}/courses/{course} should respond with status 422: Title Missing", async () => {
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

	it("7f: PUT /api/v1/orgs/{org}/courses/{course} should respond with status 422: Department Missing", async () => {
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

	it("7g: PUT /api/v1/orgs/{org}/courses/{course} should respond with status 422: Code Missing", async () => {
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
			links: {
				self: "/api/v1/orgs/ubc/courses/cpsc310",
				org: "/api/v1/orgs/ubc",
				sections: [],
			},
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
});
