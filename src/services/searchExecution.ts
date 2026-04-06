import { getModel, Course, Building } from "../models/Model";
import Decimal from "decimal.js";

const mfields = ["avg", "pass", "fail", "audit", "year"];
const sfields = ["title", "dept", "code", "instructor"];
const mfieldsFacility = ["lat", "lon", "seats"];
const sfieldsFacility = ["address", "building", "furniture", "href", "name", "number", "type"];

export function executeQueryV2(query: any, data: any[], kind: string, mfs: string[], sfs: string[]) {
	const model = getModel();

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
	const model = getModel();

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

function evaluateFilterV2(filter: any, item: any, kind: string): boolean {
	const model = getModel();

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
	const model = getModel();

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
