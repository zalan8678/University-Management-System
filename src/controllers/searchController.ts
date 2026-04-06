// route -> 2. CONTROLLER -> service

import { Request, Response } from "express";
import { searchService } from "../services/searchService";

export async function searchController(req: Request, res: Response) {
	const { kind, query } = req.body ?? {};
	const validationBasic = validateSearchBasic(req.body);
	if (!validationBasic.valid) {
		res.status(422).send({
			error: "Validation failed",
			fields: validationBasic.fields,
		});
		return;
	}

	try {
		const results = await searchService(kind, query);
		res.status(200).send(results);
	} catch (err: any) {
		if (err.message.includes("5000")) {
			res.status(413).send({
				error: "Too many results",
				message: "Query would return more than 5000 results",
				limit: 5000,
			});
		} else {
			res.status(400).send({ error: "Invalid query", message: err.message });
		}
	}
}

function validateSearchBasic(body: any) {
	// maybe move out?
	const { kind, query } = body ?? {};

	const fields: Record<string, string> = {};

	if (kind === undefined) fields.kind = "required but missing";
	else if (kind !== "course_offerings" && kind !== "facilities") {
		fields.kind = "expected to be course_offerings or facilities";
	}

	if (query === undefined) fields.query = "required but missing";
	else if (typeof query !== "object" || query === null) {
		fields.query = "expected an object";
	}

	if (Object.keys(fields).length > 0) {
		return { valid: false, fields };
	}

	return { valid: true, kind, query };
}
