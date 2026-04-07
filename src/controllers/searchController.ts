// route -> 2. CONTROLLER -> service

import { Request, Response } from "express";
import { searchService } from "../services/searchService";
import { handleError } from "../middleware/handleErrors";

export async function searchController(req: Request, res: Response) {
	const { kind, query } = req.body ?? {};

	try {
		const results = await searchService(kind, query);
		res.status(200).send(results);
	} catch (err: any) {
		handleError(err, res);
	}
}
