import { validateQueryV2 } from "./searchValidation";
import { executeQueryV2 } from "./searchExecution";
import { getModel } from "../models/Model";

const mfields = ["avg", "pass", "fail", "audit", "year"];
const sfields = ["title", "dept", "code", "instructor"];
const mfieldsFacility = ["lat", "lon", "seats"];
const sfieldsFacility = ["address", "building", "furniture", "href", "name", "number", "type"];

export async function searchService(kind: string, query: any) {
	const model = getModel();

	const currentMFields = kind === "course_offerings" ? mfields : mfieldsFacility;
	const currentSFields = kind === "course_offerings" ? sfields : sfieldsFacility;

	validateQueryV2(query, currentMFields, currentSFields);

	const data = kind === "course_offerings" ? model.getSections() : model.getRooms();
	const results = executeQueryV2(query, data, kind, currentMFields, currentSFields);

	if (results.length > 5000) {
		throw new Error("Query would return more than 5000 results");
	}

	return results;
}
