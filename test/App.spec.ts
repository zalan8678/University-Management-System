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

	it("3b: PUT /api/v1/orgs/{org} should respond with status 204 and body org data", async () => {
		await request(app).put("/api/v1/orgs/ubc").send({ name: "UBC" });
		const res = await request(app).put("/api/v1/orgs/ubc").send({ name: "The University of British Columbia" });
		expect(res).to.have.property("status", NO_CONTENT);
		expect(res).to.have.deep.property("body", {});
	});

	it("3c: PUT /api/v1/orgs/{org} should respond with status 422", async () => {
		const res = await request(app).put("/api/v1/orgs/ubc");
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
			fields: { name: "no org with id 'ubc'" },
		});
	});
});
