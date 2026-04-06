export function validateSearchBasic(body: any) {
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
