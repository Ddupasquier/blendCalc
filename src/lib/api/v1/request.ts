const MAX_QUERY_LENGTH = 120;
const MAX_OFFSET = 1000;

export class ApiV1RequestError extends Error {
	status: number;
	code: string;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.name = "ApiV1RequestError";
		this.status = status;
		this.code = code;
	}
}

const readWholeNumber = (
	url: URL,
	key: string,
	fallback: number,
	minimum: number,
	maximum: number,
) => {
	const rawValue = url.searchParams.get(key);
	if (rawValue === null) return fallback;
	const value = Number(rawValue);
	if (!Number.isInteger(value) || value < minimum || value > maximum) {
		throw new ApiV1RequestError(
			400,
			"invalid_pagination",
			`${key} must be a whole number between ${minimum} and ${maximum}.`,
		);
	}
	return value;
};

export const readApiV1SearchRequest = (url: URL) => {
	const query = (url.searchParams.get("q") ?? "").trim();
	if (query.length < 2) {
		throw new ApiV1RequestError(
			400,
			"invalid_query",
			"q must contain at least two characters.",
		);
	}
	if (query.length > MAX_QUERY_LENGTH) {
		throw new ApiV1RequestError(
			400,
			"invalid_query",
			`q cannot exceed ${MAX_QUERY_LENGTH} characters.`,
		);
	}
	return {
		query,
		limit: readWholeNumber(url, "limit", 15, 1, 50),
		offset: readWholeNumber(url, "offset", 0, 0, MAX_OFFSET),
	};
};

export const readApiV1CategoryRequest = (url: URL) => ({
	limit: readWholeNumber(url, "limit", 50, 1, 100),
	offset: readWholeNumber(url, "offset", 0, 0, MAX_OFFSET),
});

export const readApiV1RevisionHistoryRequest = (url: URL) => ({
	limit: readWholeNumber(url, "limit", 25, 1, 100),
	offset: readWholeNumber(url, "offset", 0, 0, MAX_OFFSET),
});
