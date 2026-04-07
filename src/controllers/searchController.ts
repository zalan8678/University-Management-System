// route -> 2. CONTROLLER -> service

import { Request, Response } from "express";
import { searchService } from "../services/searchService";

export async function searchController(req: Request, res: Response) {
	const { kind, query } = req.body ?? {};

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
