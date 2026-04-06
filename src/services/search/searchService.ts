// import { validateQueryV2 } from "./searchValidation";
// import { executeQueryV2 } from "./searchExecution";
// // import model

// export async function searchService(kind: string, query: any) {
// 		const currentMFields = kind === "course_offerings" ? mfields : mfieldsFacility;
// 		const currentSFields = kind === "course_offerings" ? sfields : sfieldsFacility;

// 		validateQueryV2(query, currentMFields, currentSFields);

// 		const data = kind === "course_offerings" ? model.getSections() : model.getRooms();
// 		const results = executeQueryV2(query, data, kind, currentMFields, currentSFields);

// 		if (results.length > 5000) {
// 			throw new Error("Query would return more than 5000 results");
// 		}

// 		return results;
// }
