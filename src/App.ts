import fs from "fs/promises";
import express from "express";
import cors from "cors";
import path from "path";
import Decimal from "decimal.js";

/**
 * Express application.
 */
export type Application = ReturnType<typeof express>;
const mfields = ["avg", "pass", "fail", "audit", "year"];
const sfields = ["title", "dept", "code", "instructor"];
const mfieldsFacility = ["lat", "lon", "seats"];
const sfieldsFacility = ["address", "building", "furniture", "href", "name", "number", "type"];
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
	const parse5 = await import("parse5");
	const upload = multer({ storage: multer.memoryStorage() });
	let idCounter = 1;
	const datasetsC = new Map<string, DatasetC>(); // where string is the DatasetID
	const datasetsF = new Map<string, DatasetF>(); // where string is the DatasetID

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
	app.post("/api/v2/datasets", upload.single("archive"), async (req, res) => {
		// REQUEST VALIDATION
		const kind = req.body?.kind;
		const archive = req.file;

		const fields: Record<string, string> = {}; // format is ai generated (and modified)

		if (kind === undefined) {
			fields.kind = "required but missing";
		} else if (kind !== "course_offerings" && kind !== "facilities") {
			fields.kind = "expected to be course_offerings or facilities";
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

		if (kind == "course_offerings") {
			const data: DatasetC = {
				// this line is ai gen'd
				id,
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
			};

			datasetsC.set(id, data);
		} else {
			const data: DatasetF = {
				id,
				status: "processing",
				kind: "facilities",
				stats: {
					buildings_added: 0,
					buildings_modified: 0,
					rooms_added: 0,
					rooms_modified: 0,
				},
				message: "Processing in progress",
			};

			datasetsF.set(id, data);
		}

		// PROCESS DATASET

		res.status(202).send({
			id: id,
			status: "processing",
			kind: kind,
			message: "Dataset accepted for processing",
		});

		if (archive) {
			await processDataset(id, archive.buffer, kind);
		}

		// TEMP STATUS: PROCESSING
		return;
	});

	async function processDataset(id: string, buffer: Buffer, kind: String) {
		let dataset;
		if (kind == "course_offerings") {
			dataset = datasetsC.get(id);
		} else if (kind == "facilities") {
			dataset = datasetsF.get(id);
		}

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
		if (kind == "course_offerings") {
			await processCourse(dataset as DatasetC, zip);
		} else if (kind == "facilities") {
			await processFacilities(dataset as DatasetF, zip);
		} else {
			return; // error
		}

		try {
			await model.writeModel();
			if (dataset.status !== "failed") {
				dataset.status = "completed";
				dataset.message = "Dataset processing complete";
			}
		} catch {
			// for testing
		}
	}

	// -- HELPER FUNCTIONS FOR POST DATASETS --
	async function processFacilities(dataset: DatasetF, zip: any) {
		// function contains some code gen'd from ai (albeit modified)
		// Validate index.htm
		const indexFile = zip.file("index.htm");
		if (!indexFile) {
			dataset.status = "failed";
			dataset.message = "Missing index.htm file";
			return;
		}

		// Attempt parse (ai gen)
		let root: any;
		try {
			const indexContent = await indexFile.async("string");
			root = parse5.parse(indexContent);
			if (!root) throw new Error();
		} catch {
			dataset.status = "failed";
			dataset.message = "index.htm could not be parsed";
			return;
		}

		// parse5 traversal helpers (ai gen)
		function getAttr(node: any, name: string): string | undefined {
			if (!node.attrs) return undefined;
			for (const attr of node.attrs) {
				if (attr.name === name) return attr.value;
			}
			return undefined;
		}

		function getTextContent(node: any): string {
			if (node.nodeName === "#text") {
				if (node.value) return node.value;
				return "";
			}
			if (!node.childNodes) return "";
			let result = "";
			for (const child of node.childNodes) {
				result += getTextContent(child);
			}
			return result;
		}

		function hasClass(node: any, cls: string): boolean {
			const classAttr = getAttr(node, "class");
			if (!classAttr) return false;
			for (const c of classAttr.split(/\s+/)) {
				if (c === cls) return true;
			}
			return false;
		}

		function findFirst(node: any, predicate: (n: any) => boolean): any | null {
			if (predicate(node)) return node;
			if (!node.childNodes) return null;
			for (const child of node.childNodes) {
				const result = findFirst(child, predicate);
				if (result) return result;
			}
			return null;
		}

		function findAll(node: any, predicate: (n: any) => boolean): any[] {
			const results: any[] = [];
			if (predicate(node)) results.push(node);
			if (!node.childNodes) return results;
			for (const child of node.childNodes) {
				for (const r of findAll(child, predicate)) {
					results.push(r);
				}
			}
			return results;
		}

		function findByClass(node: any, cls: string): any | null {
			return findFirst(node, (n) => {
				if (!n.attrs) return false;
				return hasClass(n, cls);
			});
		}

		function findAllByClass(node: any, cls: string): any[] {
			return findAll(node, (n) => {
				if (!n.attrs) return false;
				return hasClass(n, cls);
			});
		}

		function findTable(node: any): any | null {
			return findFirst(node, (n) => {
				if (n.nodeName !== "table") return false;
				return hasClass(n, "views-table");
			});
		}

		function getRows(table: any): any[] {
			return findAll(table, (n) => n.nodeName === "tr");
		}

		// end ai gen

		// Attempt to Find Table
		const buildingTable = findTable(root);
		if (!buildingTable) {
			dataset.status = "failed";
			dataset.message = "No building table found in index.htm";
			return;
		}

		// Extract building information

		interface buildingInfo {
			fullname: string;
			shortname: string;
			address: string;
			link: string;
		}

		const buildingInfos: buildingInfo[] = []; // ai gen'ed

		for (const row of getRows(buildingTable)) {
			try {
				const fullNameCell = findByClass(row, "views-field-title");
				const shortNameCell = findByClass(row, "views-field-field-building-code");
				const addressCell = findByClass(row, "views-field-field-building-address");

				if (!fullNameCell || !shortNameCell || !addressCell) {
					continue;
				} // skip any row that has missing info
				const fullNameAnchor = findFirst(fullNameCell, (n) => n.nodeName === "a");
				if (!fullNameAnchor) continue;

				const fullname = getTextContent(fullNameAnchor).trim();
				const link = getAttr(fullNameAnchor, "href")?.trim();
				const shortname = getTextContent(shortNameCell).trim();
				const address = getTextContent(addressCell).trim();

				if (!fullname || !link || !shortname || !address) continue; // skip if no text

				buildingInfos.push({ fullname, shortname, address, link });
			} catch {
				continue; // skip row if error
			}
		}

		for (const building of buildingInfos) {
			interface RoomInfo {
				number: string;
				seats: number;
				furniture: string;
				type: string;
				href: string;
			}

			const rooms: RoomInfo[] = [];

			try {
				// ai gen'd
				const linkPath = building.link.replace(/^\.\//, "");
				const roomFile = zip.file(linkPath);

				if (roomFile) {
					const roomContent = await roomFile.async("string");
					const roomRoot = parse5.parse(roomContent);
					const roomTable = findTable(roomRoot);
					if (roomTable) {
						for (const row of getRows(roomTable)) {
							try {
								const numberCell = findByClass(row, "views-field-field-room-number");
								const seatsCell = findByClass(row, "views-field-field-room-capacity");
								const furnitureCell = findByClass(row, "views-field-field-room-furniture");
								const typeCell = findByClass(row, "views-field-field-room-type");
								const hrefCell = findByClass(row, "views-field-nothing");

								if (!numberCell || !seatsCell || !furnitureCell || !typeCell || !hrefCell) {
									continue;
								} // skip
								const numberAnchor = findFirst(numberCell, (n) => n.nodeName === "a");
								const hrefAnchor = findFirst(hrefCell, (n) => n.nodeName === "a");

								if (!numberAnchor || !hrefAnchor) {
									continue;
								}

								const number = getTextContent(numberAnchor).trim();
								const seats = parseInt(getTextContent(seatsCell).trim(), 10);
								const furniture = getTextContent(furnitureCell).trim();
								const type = getTextContent(typeCell).trim();
								const href = getAttr(hrefAnchor, "href")?.trim();

								if (!number || isNaN(seats) || seats < 0 || !furniture || !type || !href) continue;

								rooms.push({ number, seats, furniture, type, href });
							} catch {
								continue; // skip row if error
							}
						}
					}
				}
			} catch {
				// building still valid
			}

			// Step 6: Extract geolocation information

			let lat: number;
			let lon: number;

			try {
				const encodedAddr = encodeURIComponent(building.address);
				const geoRes = await fetch(`http://cs310.students.cs.ubc.ca:11316/api/v1/project_team006/${encodedAddr}`);
				const geoData = (await geoRes.json()) as any; // parse

				if (geoData.error || geoData.lat === undefined || geoData.lon === undefined) continue;

				lat = geoData.lat;
				lon = geoData.lon;
			} catch {
				// error = ignore
				continue;
			}

			// 7: Load buildings

			try {
				// ai gen'd
				validateBuilding(building.shortname, building.fullname, building.address, lat, lon);
			} catch {
				continue; // skip invalid building
			}

			const currBuilding = model.getBuildingById(building.shortname);
			if (!currBuilding) {
				// new building
				model.setBuilding(building.shortname, building.fullname, building.address, lat, lon);
				dataset.stats.buildings_added++;
			} else if (
				// needs updating
				currBuilding.name !== building.fullname ||
				currBuilding.address !== building.address ||
				currBuilding.lat !== lat ||
				currBuilding.lon !== lon
			) {
				model.setBuilding(building.shortname, building.fullname, building.address, lat, lon);
				dataset.stats.buildings_modified++;
			} // else ignore

			for (const room of rooms) {
				try {
					// ai gen'd
					validateRoom(building.shortname, room.number, room.seats, room.type, room.furniture, room.href);
				} catch {
					continue;
				}

				const roomId = `${building.shortname}_${room.number}`;
				const existingRoom = model.getRoomById(roomId, building.shortname);

				if (!existingRoom) {
					model.setRoom(
						roomId,
						building.shortname,
						building.shortname,
						room.number,
						room.type,
						room.furniture,
						room.href,
						room.seats
					);
					dataset.stats.rooms_added++;
				} else if (
					existingRoom.building !== building.shortname ||
					existingRoom.number !== room.number ||
					existingRoom.seats !== room.seats ||
					existingRoom.type !== room.type ||
					existingRoom.furniture !== room.furniture ||
					existingRoom.href !== room.href
				) {
					model.setRoom(
						roomId,
						building.shortname,
						building.shortname,
						room.number,
						room.type,
						room.furniture,
						room.href,
						room.seats
					);
					dataset.stats.rooms_modified++;
				}
			}
		}
	}

	function validateBuilding(shortname: string, fullname: string, address: string, lat: number, lon: number) {
		// ai gen
		if (!shortname || typeof shortname !== "string") throw new Error();
		if (!fullname || typeof fullname !== "string") throw new Error();
		if (!address || typeof address !== "string") throw new Error();
		if (typeof lat !== "number" || isNaN(lat)) throw new Error();
		if (typeof lon !== "number" || isNaN(lon)) throw new Error();
	}

	function validateRoom( // ai gen
		building: string,
		number: string,
		seats: number,
		type: string,
		furniture: string,
		href: string
	) {
		if (!building || typeof building !== "string") throw new Error();
		if (!number || typeof number !== "string") throw new Error();
		if (typeof seats !== "number" || isNaN(seats) || seats < 0) throw new Error();
		if (!type || typeof type !== "string") throw new Error();
		if (!furniture || typeof furniture !== "string") throw new Error();
		if (!href || typeof href !== "string") throw new Error();
	}

	async function processCourse(dataset: DatasetC, zip: any) {
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
				if (section.Section === "overall") {
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
	app.get("/api/v2/datasets/:id", (req, res) => {
		const dataset = datasetsC.get(req.params.id) ?? datasetsF.get(req.params.id);

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
		const limit = req.query.limit !== undefined ? parseInt(req.query.limit as string) : 100; // ai gen'd line
		const offset = req.query.offset !== undefined ? parseInt(req.query.offset as string) : 0; // also ai gen'd line
		if (Number.isNaN(offset) || Number.isNaN(limit) || offset < 0 || limit < 1 || limit > 5000) {
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
		const sectionCount = course.sectionIds.length;

		// delete
		await model.delCourse(req.params.courseId); // also handles parents
		res.status(200).send({
			id: course.id,
			title: course.title,
			dept: course.dept,
			code: course.code,
			sections: sectionCount,
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
		const limit = req.query.limit !== undefined ? parseInt(req.query.limit as string) : 100; // ai gen
		const offset = req.query.offset !== undefined ? parseInt(req.query.offset as string) : 0; // also ai gen

		if (Number.isNaN(offset) || Number.isNaN(limit) || offset < 0 || limit < 1 || limit > 5000) {
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
	app.post("/api/v2/search", async (req, res) => {
		const { kind, query } = req.body ?? {};

		// TODO: Make routes thin by moving validation out of route
		// 1. Basic Validation
		const fields: Record<string, string> = {};
		if (kind === undefined) fields.kind = "required but missing";
		else if (kind !== "course_offerings" && kind !== "facilities") {
			fields.kind = "expected to be course_offerings or facilities";
		}

		if (query === undefined) fields.query = "required but missing";
		else if (typeof query !== "object" || query === null) fields.query = "expected an object";

		if (Object.keys(fields).length > 0) {
			res.status(422).send({ error: "Validation failed", fields });
			return;
		}

		try {
			// 2. Validate and Execute Query
			const currentMFields = kind === "course_offerings" ? mfields : mfieldsFacility;
			const currentSFields = kind === "course_offerings" ? sfields : sfieldsFacility;

			validateQueryV2(query, currentMFields, currentSFields);

			const data = kind === "course_offerings" ? model.getSections() : model.getRooms();
			const results = executeQueryV2(query, data, kind, currentMFields, currentSFields);

			if (results.length > 5000) {
				res.status(413).send({
					error: "Too many results",
					message: "Query would return more than 5000 results",
					limit: 5000,
				});
				return;
			}

			res.status(200).send(results);
		} catch (err: any) {
			res.status(400).send({ error: "Invalid query", message: err.message });
		}
	});
	// ... (Helper logic for projectRowV2 and evaluateFilterV2 similar to V1 but kind-aware) ...
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
	function validateQueryV2(query: any, mfs: string[], sfs: string[]) {
		if (!query.WHERE || typeof query.WHERE !== "object") throw new Error("Missing WHERE");
		if (!query.OPTIONS || typeof query.OPTIONS !== "object") throw new Error("Missing OPTIONS");
		if (!query.OPTIONS.COLUMNS || !Array.isArray(query.OPTIONS.COLUMNS) || query.OPTIONS.COLUMNS.length === 0) {
			throw new Error("Missing COLUMNS or empty array");
		}

		const allValidKeys = [...mfs, ...sfs];

		// 1. Validate WHERE Deeply (Ensures no mixing of dataset fields and correct types)
		validateFilterV2(query.WHERE, mfs, sfs);

		// 2. Validate Transformations
		if (query.TRANSFORMATIONS) {
			if (
				!query.TRANSFORMATIONS.GROUP ||
				!Array.isArray(query.TRANSFORMATIONS.GROUP) ||
				query.TRANSFORMATIONS.GROUP.length === 0
			) {
				throw new Error("Missing GROUP in TRANSFORMATIONS");
			}
			if (!query.TRANSFORMATIONS.APPLY || !Array.isArray(query.TRANSFORMATIONS.APPLY)) {
				throw new Error("Missing APPLY in TRANSFORMATIONS");
			}

			const groupKeys = query.TRANSFORMATIONS.GROUP;
			const applyKeys = new Set<string>();

			// Validate GROUP keys
			for (const key of groupKeys) {
				if (!allValidKeys.includes(key)) throw new Error(`Invalid GROUP key: ${key}`);
			}

			// Validate APPLY rules
			for (const rule of query.TRANSFORMATIONS.APPLY) {
				if (typeof rule !== "object" || Object.keys(rule).length !== 1) throw new Error("Invalid APPLY rule format");

				const applyKey = Object.keys(rule)[0];

				// Apply keys cannot have underscores and must be unique
				if (applyKey.includes("_")) throw new Error("applykey cannot contain underscores");
				if (applyKeys.has(applyKey)) throw new Error(`Duplicate applykey found: ${applyKey}`);
				applyKeys.add(applyKey);

				const tokenObj = rule[applyKey];
				if (typeof tokenObj !== "object" || Object.keys(tokenObj).length !== 1)
					throw new Error("Invalid APPLY token object");

				const token = Object.keys(tokenObj)[0];
				const targetKey = tokenObj[token];

				if (!["MAX", "MIN", "AVG", "COUNT", "SUM"].includes(token)) throw new Error(`Invalid APPLY token: ${token}`);
				if (!allValidKeys.includes(targetKey)) throw new Error(`Invalid target key in APPLY: ${targetKey}`);

				// MAX, MIN, AVG, SUM can ONLY target mfields (numbers)
				if (["MAX", "MIN", "AVG", "SUM"].includes(token)) {
					if (!mfs.includes(targetKey)) throw new Error(`${token} must target a numeric field (mfield)`);
				}
			}

			// All columns must be in GROUP or APPLY
			for (const col of query.OPTIONS.COLUMNS) {
				if (!groupKeys.includes(col) && !applyKeys.has(col)) {
					throw new Error("When TRANSFORMATIONS is present, all COLUMNS must be in GROUP or APPLY");
				}
			}
		} else {
			// No Transformations: Columns must be raw fields
			for (const col of query.OPTIONS.COLUMNS) {
				if (!allValidKeys.includes(col)) throw new Error(`Unknown key in COLUMNS: ${col}`);
			}
		}

		// 3. Validate Order
		if (query.OPTIONS.ORDER !== undefined) {
			const order = query.OPTIONS.ORDER;

			if (typeof order === "string") {
				// Single key sort
				if (!query.OPTIONS.COLUMNS.includes(order)) throw new Error("ORDER key must be in COLUMNS");
			} else if (typeof order === "object" && order !== null) {
				// Multi-key sort
				if (!order.dir || !["UP", "DOWN"].includes(order.dir)) throw new Error("Invalid ORDER direction");
				if (!order.keys || !Array.isArray(order.keys) || order.keys.length === 0)
					throw new Error("Invalid ORDER keys array");

				for (const key of order.keys) {
					if (!query.OPTIONS.COLUMNS.includes(key)) throw new Error(`ORDER key '${key}' must be in COLUMNS`);
				}
			} else {
				throw new Error("ORDER must be a string or an object with 'dir' and 'keys'");
			}
		}
	}

	function validateFilterV2(filter: any, mfs: string[], sfs: string[]) {
		if (Object.keys(filter).length === 0) return; // Empty WHERE {} is valid
		if (Object.keys(filter).length > 1) throw new Error("WHERE/Logic blocks must contain exactly one key");

		const key = Object.keys(filter)[0];
		const value = filter[key];

		if (key === "AND" || key === "OR") {
			if (!Array.isArray(value) || value.length === 0) throw new Error(`${key} must be a non-empty array`);
			value.forEach((f) => validateFilterV2(f, mfs, sfs));
			return;
		}

		if (key === "NOT") {
			if (typeof value !== "object" || Object.keys(value).length === 0)
				throw new Error("NOT must be a non-empty object");
			validateFilterV2(value, mfs, sfs);
			return;
		}

		if (["LT", "GT", "EQ"].includes(key)) {
			if (typeof value !== "object" || Object.keys(value).length !== 1)
				throw new Error(`${key} must be an object with exactly one key`);
			const field = Object.keys(value)[0];
			if (!mfs.includes(field)) throw new Error(`${key} targets an invalid mfield (or wrong dataset field): ${field}`);
			if (typeof value[field] !== "number") throw new Error(`${key} value must be a number`);
			return;
		}

		if (key === "IS") {
			if (typeof value !== "object" || Object.keys(value).length !== 1)
				throw new Error(`IS must be an object with exactly one key`);
			const field = Object.keys(value)[0];
			if (!sfs.includes(field)) throw new Error(`IS targets an invalid sfield (or wrong dataset field): ${field}`);

			const strVal = value[field];
			if (typeof strVal !== "string") throw new Error(`IS value must be a string`);

			const starCount = (strVal.match(/\*/g) || []).length;
			if (starCount > 2 || (starCount === 2 && !(strVal.startsWith("*") && strVal.endsWith("*")))) {
				throw new Error("IS asterisks can only be the first or last character");
			}
			if (strVal.length > 2 && strVal.slice(1, -1).includes("*")) {
				throw new Error("IS asterisks can only be the first or last character");
			}
			return;
		}

		throw new Error(`Unknown filter key: ${key}`);
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
	function executeQueryV2(query: any, data: any[], kind: string, mfs: string[], sfs: string[]) {
		// 1. Filter
		let filtered = data.filter((item) => evaluateFilterV2(query.WHERE, item, kind));

		// 2. Transformations (Grouping & Aggregation)
		let processed: any[];
		if (query.TRANSFORMATIONS) {
			const transformed = performTransformations(filtered, query.TRANSFORMATIONS, kind);

			// Final Projection for Transformations (The "Column Leak" Bug Fix)
			processed = transformed.map((item) => {
				const row: any = {};
				for (const col of query.OPTIONS.COLUMNS) {
					row[col] = item[col];
				}
				return row;
			});
		} else {
			processed = filtered.map((item) => projectRowV2(item, query.OPTIONS.COLUMNS, kind));
		}

		// 3. Sorting (Handle V1 string or V2 Sort Object)
		if (query.OPTIONS.ORDER) {
			const order = query.OPTIONS.ORDER;
			const isV2Sort = typeof order === "object" && order !== null;
			const direction = isV2Sort ? order.dir : "UP";
			const keys = isV2Sort ? order.keys : [order];

			processed.sort((a, b) => {
				for (const key of keys) {
					if (a[key] < b[key]) return direction === "UP" ? -1 : 1;
					if (a[key] > b[key]) return direction === "UP" ? 1 : -1;
				}
				return 0; // Maintain stable sort if all sort keys are equal
			});
		}

		return processed;
	}

	function performTransformations(data: any[], transformations: any, kind: string): any[] {
		const groups = new Map<string, any[]>();
		const { GROUP, APPLY } = transformations;

		// Grouping
		for (const item of data) {
			const groupValues = GROUP.map((k: string) => {
				if (kind === "course_offerings" && sfields.includes(k) && k !== "instructor") {
					return model.getCourseById(item.courseId)?.[k as keyof Course];
				} else if (kind === "facilities" && ["name", "address", "lat", "lon"].includes(k)) {
					// Fix: Fetch building-level fields for grouping
					return model.getBuildingById(item.buildingId)?.[k as keyof Building];
				}
				return item[k];
			});

			// Serialize array to JSON string to prevent collision bugs (e.g., "cpsc|john" vs "cpsc", "john|doe")
			const groupKey = JSON.stringify(groupValues);

			if (!groups.has(groupKey)) groups.set(groupKey, []);
			groups.get(groupKey)!.push(item);
		}

		// Aggregation
		return Array.from(groups.values()).map((groupItems) => {
			const result: any = {};

			// Set Group Keys
			GROUP.forEach((k: string) => {
				if (kind === "course_offerings" && sfields.includes(k) && k !== "instructor") {
					result[k] = model.getCourseById(groupItems[0].courseId)?.[k as keyof Course];
				} else if (kind === "facilities" && ["name", "address", "lat", "lon"].includes(k)) {
					// Fix: Fetch building-level fields for group key projection
					result[k] = model.getBuildingById(groupItems[0].buildingId)?.[k as keyof Building];
				} else {
					result[k] = groupItems[0][k];
				}
			});

			// Set Apply Keys
			APPLY.forEach((rule: any) => {
				const applyKey = Object.keys(rule)[0];
				const entry = rule[applyKey];
				const token = Object.keys(entry)[0];
				const key = entry[token];

				// Fix: Extract values BEFORE passing to calculateAggregation to handle parent-level COUNT lookups
				const values = groupItems.map((item) => {
					if (kind === "course_offerings" && sfields.includes(key) && key !== "instructor") {
						return model.getCourseById(item.courseId)?.[key as keyof Course];
					} else if (kind === "facilities" && ["name", "address", "lat", "lon"].includes(key)) {
						return model.getBuildingById(item.buildingId)?.[key as keyof Building];
					}
					return item[key];
				});

				result[applyKey] = calculateAggregation(values, token);
			});

			return result;
		});
	}

	function calculateAggregation(values: any[], token: string): number {
		switch (token) {
			case "MAX":
				return Math.max(...values);
			case "MIN":
				return Math.min(...values);
			case "COUNT":
				return new Set(values).size;
			case "SUM": {
				let sum = new Decimal(0);
				for (const val of values) {
					if (typeof val === "number") {
						sum = sum.add(new Decimal(val));
					}
				}
				return Number(sum.toNumber().toFixed(2));
			}
			case "AVG": {
				let total = new Decimal(0);
				let count = 0;
				for (const val of values) {
					if (typeof val === "number") {
						total = total.add(new Decimal(val));
						count++;
					}
				}
				if (count === 0) return 0;
				const avg = total.toNumber() / count;
				return Number(avg.toFixed(2));
			}
			default:
				return 0;
		}
	}

	function evaluateFilterV2(filter: any, item: any, kind: string): boolean {
		if (Object.keys(filter).length === 0) return true;

		const key = Object.keys(filter)[0];
		const value = filter[key];

		// Recursive Logic
		if (key === "AND") return value.every((f: any) => evaluateFilterV2(f, item, kind));
		if (key === "OR") return value.some((f: any) => evaluateFilterV2(f, item, kind));
		if (key === "NOT") return !evaluateFilterV2(value, item, kind);

		// Comparisons
		const field = Object.keys(value)[0];
		let actualValue: any;

		if (kind === "course_offerings") {
			if (sfields.includes(field) && field !== "instructor") {
				const course = model.getCourseById(item.courseId);
				actualValue = course ? (course as any)[field] : "";
			} else {
				actualValue = item[field];
			}
		} else {
			// Fix: Look up parent Building for building-level fields
			if (["name", "address", "lat", "lon"].includes(field)) {
				const building = model.getBuildingById(item.buildingId);
				actualValue = building ? (building as any)[field] : undefined;
			} else {
				actualValue = item[field];
			}
		}

		if (key === "LT") return actualValue < value[field];
		if (key === "GT") return actualValue > value[field];
		if (key === "EQ") return actualValue === value[field];
		if (key === "IS") return matchWildcard(String(actualValue), value[field]);

		return false;
	}

	function projectRowV2(item: any, columns: string[], kind: string): any {
		const row: any = {};

		for (const col of columns) {
			if (kind === "course_offerings") {
				if (mfields.includes(col) || col === "instructor") {
					row[col] = item[col];
				} else {
					const course = model.getCourseById(item.courseId);
					row[col] = course ? (course as any)[col] : undefined;
				}
			} else {
				// Fix: Fetch from Building model for parent fields
				if (["name", "address", "lat", "lon"].includes(col)) {
					const building = model.getBuildingById(item.buildingId);
					row[col] = building ? (building as any)[col] : undefined;
				} else {
					row[col] = item[col];
				}
			}
		}

		return row;
	}
	// 5
	app.get("/api/v2/buildings", (req, res) => {
		// get courses
		const limit = req.query.limit !== undefined ? parseInt(req.query.limit as string) : 100; // ai gen'd line
		const offset = req.query.offset !== undefined ? parseInt(req.query.offset as string) : 0; // also ai gen'd line
		if (Number.isNaN(offset) || Number.isNaN(limit) || offset < 0 || limit < 1 || limit > 5000) {
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
		const buildings = model
			.getBuildings()
			.slice()
			.sort((a, b) => a.id.localeCompare(b.id));
		// End of AI Code
		const paginatedResults = buildings.slice(offset, offset + limit);
		const courseResults = paginatedResults.map((building) => {
			return {
				id: building.id,
				name: building.name,
				address: building.address,
				lat: building.lat,
				lon: building.lon,
				links: {
					self: `/api/v2/buildings/${building.id}`,
					rooms: `/api/v2/buildings/${building.id}/rooms`,
				},
			};
		});
		const body = {
			total: buildings.length,
			limit: limit,
			offset: offset,
			items: courseResults,
		};
		res.status(200).send(body);
	});

	app.get("/api/v2/buildings/:buildingId", (req, res) => {
		// get course
		const building = model.getBuildingById(req.params.buildingId);
		if (!building) {
			res.status(404).send({
				error: "Not found",
				message: `no building with id '${req.params.buildingId}'`,
			});
			return;
		}

		// response
		res.status(200).send({
			id: building.id,
			name: building.name,
			address: building.address,
			lat: building.lat,
			lon: building.lon,
			links: {
				self: `/api/v2/buildings/${building.id}`,
				rooms: `/api/v2/buildings/${building.id}/rooms`,
			},
		});
	});
	app.put("/api/v2/buildings/:buildingId", async (req, res) => {
		const name = req.body?.name;
		const address = req.body?.address;
		const lat = req.body?.lat;
		const lon = req.body?.lon;

		const fields: Record<string, string> = {}; // start of ai generated

		if (name === undefined) {
			fields.name = "required but missing";
		} else if (typeof name !== "string") {
			fields.name = "expected a string";
		}
		if (address === undefined) {
			fields.address = "required but missing";
		} else if (typeof address !== "string") {
			fields.address = "expected a string";
		}
		if (lat === undefined) {
			fields.lat = "required but missing";
		} else if (typeof lat !== "number") {
			fields.lat = "expected a number";
		}
		if (lon === undefined) {
			fields.lon = "required but missing";
		} else if (typeof lon !== "number") {
			fields.lon = "expected a number";
		}
		if (Object.keys(fields).length > 0) {
			res.status(422).send({
				error: "Validation failed",
				fields,
			});
			return;
		} // end of ai generated

		// get building
		const building = model.getBuildingById(req.params.buildingId);
		const newBuilding = model.setBuilding(
			req.params.buildingId,
			req.body.name,
			req.body.address,
			req.body.lat,
			req.body.lon
		);

		if (!building) {
			res.status(201).send({
				id: newBuilding.id,
				name: newBuilding.name,
				address: newBuilding.address,
				lat: newBuilding.lat,
				lon: newBuilding.lon,
				links: {
					self: `/api/v2/buildings/${newBuilding.id}`,
					rooms: `/api/v2/buildings/${newBuilding.id}/rooms`,
				},
			});
		} else {
			res.sendStatus(204); // overwrite
		}

		await model.writeModel();
	});

	// 8
	app.delete("/api/v2/buildings/:buildingId", async (req, res) => {
		// get course
		const building = model.getBuildingById(req.params.buildingId);
		if (!building) {
			res.status(404).send({
				error: "Not found",
				message: `no building with id '${req.params.buildingId}'`,
			});
			return;
		}
		const roomCount = building.roomIds.length;
		// delete
		await model.delBuilding(req.params.buildingId);
		res.status(200).send({
			id: building.id,
			name: building.name,
			address: building.address,
			lat: building.lat,
			lon: building.lon,
			rooms: roomCount,
		});
	});
	// Start of AI Code
	app.get("/api/v2/buildings/:buildingId/rooms", (req, res) => {
		// get room
		const building = model.getBuildingById(req.params.buildingId);
		if (!building) {
			res.status(404).send({
				error: "Not found",
				message: `no building with id '${req.params.buildingId}'`,
			});
			return;
		}
		const limit = req.query.limit !== undefined ? parseInt(req.query.limit as string) : 100; // ai gen
		const offset = req.query.offset !== undefined ? parseInt(req.query.offset as string) : 0; // also ai gen

		if (Number.isNaN(offset) || Number.isNaN(limit) || offset < 0 || limit < 1 || limit > 5000) {
			res.status(400).send({
				error: "Invalid request parameters",
				params: { limit: "expected an integer between 1 and 5000", offset: "expected an integer >= 0" },
			});
			return;
		}
		// get sections
		// Generated by AI
		const rooms = (req.params.buildingId ? (model.getBuildingById(req.params.buildingId)?.roomIds ?? []) : [])
			.map((sid) => model.getRoomById(sid, req.params.buildingId)!)
			.filter(Boolean)
			.sort((a, b) => a.id.localeCompare(b.id));
		// End of AI Code
		const paginatedResults = rooms.slice(offset, offset + limit);
		const roomResults = paginatedResults.map((room) => {
			return {
				id: room.id,
				building: room.building,
				number: room.number,
				type: room.type,
				furniture: room.furniture,
				href: room.href,
				seats: room.seats,
				links: {
					self: `/api/v2/buildings/${req.params.buildingId}/rooms/${room.id}`,
					building: `/api/v2/buildings/${req.params.buildingId}`,
				},
			};
		});
		const body = {
			total: rooms.length,
			limit: limit,
			offset: offset,
			items: roomResults,
		};
		res.status(200).send(body);
	});

	// 10
	app.get("/api/v2/buildings/:buildingId/rooms/:roomId", (req, res) => {
		// get building
		const building = model.getBuildingById(req.params.buildingId);
		if (!building) {
			res.status(404).send({
				error: "Not found",
				message: `no building with id '${req.params.buildingId}'`,
			});
			return;
		}

		// get section
		const room = model.getRoomById(req.params.roomId, req.params.buildingId);
		if (!room || room.buildingId != req.params.buildingId) {
			res.status(404).send({
				error: "Not found",
				message: `no room with id '${req.params.roomId}'`,
			});
			return;
		}

		// response
		res.status(200).send({
			id: room.id,
			building: room.building,
			number: room.number,
			type: room.type,
			furniture: room.furniture,
			href: room.href,
			seats: room.seats,
			links: {
				self: `/api/v2/buildings/${req.params.buildingId}/rooms/${room.id}`,
				building: `/api/v2/buildings/${req.params.buildingId}`,
			},
		});
	});

	app.put("/api/v2/buildings/:buildingId/rooms/:roomId", async (req, res) => {
		const buildingToCheck = model.getBuildingById(req.params.buildingId);
		const { building, number, type, furniture, href, seats } = req.body || {};

		const fields: Record<string, string> = {};

		// validation
		if (building === undefined) {
			fields.building = "required but missing";
		} else if (typeof building !== "string") {
			fields.building = "expected a string";
		}

		if (number === undefined) {
			fields.number = "required but missing";
		} else if (typeof number !== "string") {
			fields.number = "expected a string";
		}

		if (type === undefined) {
			fields.type = "required but missing";
		} else if (typeof type !== "string") {
			fields.type = "expected a string";
		}

		if (furniture === undefined) {
			fields.furniture = "required but missing";
		} else if (typeof furniture !== "string") {
			fields.furniture = "expected a string";
		}

		if (href === undefined) {
			fields.href = "required but missing";
		} else if (typeof href !== "string") {
			fields.href = "expected a string";
		}

		if (seats === undefined) {
			fields.seats = "required but missing";
		} else if (typeof seats !== "number" || Number.isNaN(seats) || seats < 0) {
			fields.seats = "expected a number >= 0";
		}

		if (Object.keys(fields).length > 0) {
			res.status(422).send({
				error: "Validation failed",
				fields,
			});
			return;
		}
		if (!buildingToCheck) {
			res.status(404).send({
				error: "Not found",
				message: `no building with id '${req.params.buildingId}'`,
			});
			return;
		}

		// check room
		const room = model.getRoomById(req.params.roomId, req.params.buildingId);

		const newRoom = model.setRoom(
			req.params.roomId,
			req.params.buildingId,
			building,
			number,
			type,
			furniture,
			href,
			seats
		);

		if (!room) {
			// create
			res.status(201).send({
				id: newRoom.id,
				building: newRoom.building,
				number: newRoom.number,
				type: newRoom.type,
				furniture: newRoom.furniture,
				href: newRoom.href,
				seats: newRoom.seats,
				links: {
					self: req.originalUrl,
					building: `/api/v2/buildings/${req.params.buildingId}`,
				},
			});
		} else {
			// overwrite
			res.sendStatus(204);
		}

		await model.writeModel();
	});
	// 12
	app.delete("/api/v2/buildings/:buildingId/rooms/:roomId", async (req, res) => {
		const building = model.getBuildingById(req.params.buildingId);
		if (!building) {
			res.status(404).send({
				error: "Not found",
				message: `no building with id '${req.params.buildingId}'`,
			});
			return;
		}

		const room = model.getRoomById(req.params.roomId, req.params.buildingId);
		if (!room) {
			res.status(404).send({
				error: "Not found",
				message: `no room with id '${req.params.roomId}'`,
			});
			return;
		}

		await model.delRoom(req.params.roomId, req.params.buildingId);

		res.status(200).send({
			id: room.id,
			building: room.building,
			number: room.number,
			type: room.type,
			furniture: room.furniture,
			href: room.href,
			seats: room.seats,
		});
	});
	// End of AI
	return app;
}

type Data = {
	courses: Course[];
	sections: Section[];
	buildings: Building[];
	rooms: Room[];
};

class Model {
	private filepath: string; // start of genai (6 lines)
	private courseMap: Map<string, Course> = new Map();
	private sectionMap: Map<string, Section> = new Map();
	private buildingMap: Map<string, Building> = new Map();
	private roomMap: Map<string, Room> = new Map();
	private constructor(filepath: string, data: Data) {
		this.filepath = filepath;
		for (const course of data.courses) this.courseMap.set(course.id, course);
		for (const section of data.sections) this.sectionMap.set(`${section.courseId}:${section.id}`, section);
		for (const building of data.buildings) this.buildingMap.set(building.id, building);
		for (const room of data.rooms) this.roomMap.set(`${room.buildingId}:${room.id}`, room);
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
				buildings: Array.isArray(parsed.buildings) ? parsed.buildings : [],
				rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
			}; // end of ai generated
			return new Model(filepath, data);
		} catch {
			return new Model(filepath, { courses: [], sections: [], buildings: [], rooms: [] }); // file does not exist, create blank file?
		}
	}

	async writeModel(): Promise<void> {
		// use of genai in this function
		try {
			const dir = path.dirname(this.filepath);
			await fs.mkdir(dir, { recursive: true });
			const data = {
				courses: Array.from(this.courseMap.values()),
				sections: Array.from(this.sectionMap.values()),
				buildings: Array.from(this.buildingMap.values()),
				rooms: Array.from(this.roomMap.values()),
			};
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
			for (const sectionId of [...sectionIds]) {
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
	// --- Building METHODS ---

	public getBuildings(): Building[] {
		return Array.from(this.buildingMap.values());
	}

	public getBuildingById(id: string): Building | undefined {
		return this.buildingMap.get(id);
	}

	public setBuilding(id: string, name: string, address: string, lat: number, lon: number): Building {
		let building = this.getBuildingById(id);
		if (building) {
			building.name = name;
			building.address = address;
			building.lat = lat;
			building.lon = lon;
		} else {
			building = { id, name, address, lat, lon, roomIds: [] };
			this.buildingMap.set(id, building);
		}

		return building;
	}

	public async delBuilding(id: string): Promise<void> {
		if (!this.buildingMap.has(id)) {
			return;
		}

		// delete associated rooms
		const building = this.getBuildingById(id);
		const roomIds = building?.roomIds; // course cannot be undefined
		if (roomIds) {
			for (const roomId of [...roomIds]) {
				await this.delRoom(roomId, building.id);
			}
		}

		this.buildingMap.delete(id);

		await this.writeModel();
		return;
	}

	// --- Room METHODS ---

	public getRooms(): Room[] {
		return Array.from(this.roomMap.values());
	}

	public getRoomById(id: string, buildingId: string): Room | undefined {
		return this.roomMap.get(`${buildingId}:${id}`);
	}

	public setRoom(
		id: string,
		buildingId: string,
		buildingName: string,
		number: string,
		type: string,
		furniture: string,
		href: string,
		seats: number
	): Room {
		let room = this.getRoomById(id, buildingId);
		if (room) {
			// overwrite
			room.building = buildingName;
			room.number = number;
			room.type = type;
			room.furniture = furniture;
			room.href = href;
			room.seats = seats;
		} else {
			room = { id, buildingId, building: buildingName, number, type, furniture, href, seats };
			this.roomMap.set(`${buildingId}:${id}`, room);

			const building = this.getBuildingById(buildingId);
			if (building && !building.roomIds.includes(id)) {
				building.roomIds.push(id);
			}
		}

		return room;
	}

	public async delRoom(id: string, buildingId: string): Promise<void> {
		const key = `${buildingId}:${id}`;
		if (!this.roomMap.has(key)) {
			return;
		}
		this.roomMap.delete(key);

		// delete from parent
		const building = this.getBuildingById(buildingId);
		if (building && building.roomIds.includes(id)) {
			const parentIndex = building.roomIds.findIndex((roomId) => roomId === id);
			if (parentIndex !== -1) {
				building.roomIds.splice(parentIndex, 1);
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
export interface Building {
	id: string;
	name: string;
	address: string;
	lat: number;
	lon: number;
	roomIds: string[];
}
export interface Room {
	id: string;
	buildingId: string;
	building: string;
	number: string;
	type: string;
	furniture: string;
	href: string;
	seats: number;
}

export interface DatasetC {
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

export interface DatasetF {
	id: string;
	status: "processing" | "completed" | "failed";
	kind: string;
	stats: {
		buildings_added: number;
		buildings_modified: number;
		rooms_added: number;
		rooms_modified: number;
	};
	message: string;
}
