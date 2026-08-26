import {
	readBlendCalcAPIV1ErrorDefinition,
	type BlendCalcAPIV1ErrorCode,
} from "$lib/blendCalcAPI/v1/blendCalcAPIErrors";

const MAX_QUERY_LENGTH = 120;
const MAX_OFFSET = 1000;

export class BlendCalcAPIV1RequestError extends Error {
	status: number;
	code: BlendCalcAPIV1ErrorCode;

	constructor(code: BlendCalcAPIV1ErrorCode, message?: string) {
		const definition = readBlendCalcAPIV1ErrorDefinition(code);
		const safeMessage = message ?? definition.message;
		super(safeMessage);
		this.name = "BlendCalcAPIV1RequestError";
		this.status = definition.status;
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
		throw new BlendCalcAPIV1RequestError(
			"invalid_pagination",
			`${key} must be a whole number between ${minimum} and ${maximum}.`,
		);
	}
	return value;
};

export const readBlendCalcAPIV1SearchRequest = (url: URL) => {
	const query = (url.searchParams.get("q") ?? "").trim();
	if (query.length < 2) {
		throw new BlendCalcAPIV1RequestError(
			"invalid_query",
			"q must contain at least two characters.",
		);
	}
	if (query.length > MAX_QUERY_LENGTH) {
		throw new BlendCalcAPIV1RequestError(
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

export const readBlendCalcAPIV1CategoryRequest = (url: URL) => ({
	limit: readWholeNumber(url, "limit", 50, 1, 100),
	offset: readWholeNumber(url, "offset", 0, 0, MAX_OFFSET),
});

export const readBlendCalcAPIV1RevisionHistoryRequest = (url: URL) => ({
	limit: readWholeNumber(url, "limit", 25, 1, 100),
	offset: readWholeNumber(url, "offset", 0, 0, MAX_OFFSET),
});
