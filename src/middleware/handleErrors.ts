import { Response } from "express";
import { StatusCodes } from "http-status-codes";
import { TooManyResultsError } from "./errors";
const {
	OK, // OK, 200
	// Other common codes are:
	CREATED, // CREATED, // 201
	NO_CONTENT, // 204
	NOT_FOUND, // 404
	UNPROCESSABLE_ENTITY, // 422
	REQUEST_TOO_LONG, // 413
	//INTERNAL_SERVER_ERROR,
	BAD_REQUEST, // 400
} = StatusCodes;

export function handleError(err: any, res: Response) {
	if (err instanceof TooManyResultsError) {
		res.status(REQUEST_TOO_LONG).send({
			error: "Too many results",
			message: "Query would return more than 5000 results",
			limit: 5000,
		});
	} else {
		res.status(BAD_REQUEST).send({ error: "Invalid query", message: err.message });
	}
}
