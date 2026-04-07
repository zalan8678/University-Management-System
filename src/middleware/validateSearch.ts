import { Request, Response, NextFunction } from "express";

export function validateSearch(req: Request, res: Response, next: NextFunction) {
	const { kind, query } = req.body ?? {};

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
		res.status(422).send({ error: "Validation failed", fields });
        return;
	}

	next();
}
