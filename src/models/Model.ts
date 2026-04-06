import path from "path";
import fs from "fs/promises";

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
export default Model;
