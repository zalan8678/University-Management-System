// Start of AI Code
export class ValidationError extends Error {
	constructor(public message: string, public fields?: Record<string, string>) {
		super(message);
		this.name = "ValidationError";
	}
}

export class GrammarError extends Error {
	constructor(public message: string, public fields?: Record<string, string>) {
		super(message);
		this.name = "GrammarError";
	}
}
export class TooManyResultsError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TooManyResultsError";
	}
}
// End of AI Code

export class NotFoundError extends Error {
	constructor(public message: string, public fields?: Record<string, string>) {
		super(message);
		this.name = "NotFoundError";
	}
}
