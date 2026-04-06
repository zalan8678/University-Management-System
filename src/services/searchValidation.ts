export function validateQueryV2(query: any, mfs: string[], sfs: string[]) {
	if (!query.WHERE || typeof query.WHERE !== "object") throw new Error("Missing WHERE");
	if (!query.OPTIONS || typeof query.OPTIONS !== "object") throw new Error("Missing OPTIONS");
	if (!query.OPTIONS.COLUMNS || !Array.isArray(query.OPTIONS.COLUMNS) || query.OPTIONS.COLUMNS.length === 0) {
		throw new Error("Missing COLUMNS or empty array");
	}

	const allValidKeys = [...mfs, ...sfs];

	// 1. Validate WHERE Deeply (Ensures no mixing of dataset fields and correct types)
	validateFilterV2(query.WHERE, mfs, sfs);

	// 2. Validate Transformations
	if (query.TRANSFORMATIONS) {
		if (
			!query.TRANSFORMATIONS.GROUP ||
			!Array.isArray(query.TRANSFORMATIONS.GROUP) ||
			query.TRANSFORMATIONS.GROUP.length === 0
		) {
			throw new Error("Missing GROUP in TRANSFORMATIONS");
		}
		if (!query.TRANSFORMATIONS.APPLY || !Array.isArray(query.TRANSFORMATIONS.APPLY)) {
			throw new Error("Missing APPLY in TRANSFORMATIONS");
		}

		const groupKeys = query.TRANSFORMATIONS.GROUP;
		const applyKeys = new Set<string>();

		// Validate GROUP keys
		for (const key of groupKeys) {
			if (!allValidKeys.includes(key)) throw new Error(`Invalid GROUP key: ${key}`);
		}

		// Validate APPLY rules
		for (const rule of query.TRANSFORMATIONS.APPLY) {
			if (typeof rule !== "object" || Object.keys(rule).length !== 1) throw new Error("Invalid APPLY rule format");

			const applyKey = Object.keys(rule)[0];

			// Apply keys cannot have underscores and must be unique
			if (applyKey.includes("_")) throw new Error("applykey cannot contain underscores");
			if (applyKeys.has(applyKey)) throw new Error(`Duplicate applykey found: ${applyKey}`);
			applyKeys.add(applyKey);

			const tokenObj = rule[applyKey];
			if (typeof tokenObj !== "object" || Object.keys(tokenObj).length !== 1)
				throw new Error("Invalid APPLY token object");

			const token = Object.keys(tokenObj)[0];
			const targetKey = tokenObj[token];

			if (!["MAX", "MIN", "AVG", "COUNT", "SUM"].includes(token)) throw new Error(`Invalid APPLY token: ${token}`);
			if (!allValidKeys.includes(targetKey)) throw new Error(`Invalid target key in APPLY: ${targetKey}`);

			// MAX, MIN, AVG, SUM can ONLY target mfields (numbers)
			if (["MAX", "MIN", "AVG", "SUM"].includes(token)) {
				if (!mfs.includes(targetKey)) throw new Error(`${token} must target a numeric field (mfield)`);
			}
		}

		// All columns must be in GROUP or APPLY
		for (const col of query.OPTIONS.COLUMNS) {
			if (!groupKeys.includes(col) && !applyKeys.has(col)) {
				throw new Error("When TRANSFORMATIONS is present, all COLUMNS must be in GROUP or APPLY");
			}
		}
	} else {
		// No Transformations: Columns must be raw fields
		for (const col of query.OPTIONS.COLUMNS) {
			if (!allValidKeys.includes(col)) throw new Error(`Unknown key in COLUMNS: ${col}`);
		}
	}

	// 3. Validate Order
	if (query.OPTIONS.ORDER !== undefined) {
		const order = query.OPTIONS.ORDER;

		if (typeof order === "string") {
			// Single key sort
			if (!query.OPTIONS.COLUMNS.includes(order)) throw new Error("ORDER key must be in COLUMNS");
		} else if (typeof order === "object" && order !== null) {
			// Multi-key sort
			if (!order.dir || !["UP", "DOWN"].includes(order.dir)) throw new Error("Invalid ORDER direction");
			if (!order.keys || !Array.isArray(order.keys) || order.keys.length === 0)
				throw new Error("Invalid ORDER keys array");

			for (const key of order.keys) {
				if (!query.OPTIONS.COLUMNS.includes(key)) throw new Error(`ORDER key '${key}' must be in COLUMNS`);
			}
		} else {
			throw new Error("ORDER must be a string or an object with 'dir' and 'keys'");
		}
	}
}

function validateFilterV2(filter: any, mfs: string[], sfs: string[]) {
	if (Object.keys(filter).length === 0) return; // Empty WHERE {} is valid
	if (Object.keys(filter).length > 1) throw new Error("WHERE/Logic blocks must contain exactly one key");

	const key = Object.keys(filter)[0];
	const value = filter[key];

	if (key === "AND" || key === "OR") {
		if (!Array.isArray(value) || value.length === 0) throw new Error(`${key} must be a non-empty array`);
		value.forEach((f) => validateFilterV2(f, mfs, sfs));
		return;
	}

	if (key === "NOT") {
		if (typeof value !== "object" || Object.keys(value).length === 0) throw new Error("NOT must be a non-empty object");
		validateFilterV2(value, mfs, sfs);
		return;
	}

	if (["LT", "GT", "EQ"].includes(key)) {
		if (typeof value !== "object" || Object.keys(value).length !== 1)
			throw new Error(`${key} must be an object with exactly one key`);
		const field = Object.keys(value)[0];
		if (!mfs.includes(field)) throw new Error(`${key} targets an invalid mfield (or wrong dataset field): ${field}`);
		if (typeof value[field] !== "number") throw new Error(`${key} value must be a number`);
		return;
	}

	if (key === "IS") {
		if (typeof value !== "object" || Object.keys(value).length !== 1)
			throw new Error(`IS must be an object with exactly one key`);
		const field = Object.keys(value)[0];
		if (!sfs.includes(field)) throw new Error(`IS targets an invalid sfield (or wrong dataset field): ${field}`);

		const strVal = value[field];
		if (typeof strVal !== "string") throw new Error(`IS value must be a string`);

		const starCount = (strVal.match(/\*/g) || []).length;
		if (starCount > 2 || (starCount === 2 && !(strVal.startsWith("*") && strVal.endsWith("*")))) {
			throw new Error("IS asterisks can only be the first or last character");
		}
		if (strVal.length > 2 && strVal.slice(1, -1).includes("*")) {
			throw new Error("IS asterisks can only be the first or last character");
		}
		return;
	}

	throw new Error(`Unknown filter key: ${key}`);
}
