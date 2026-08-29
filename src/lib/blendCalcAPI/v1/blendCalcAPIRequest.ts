import {
	readBlendCalcAPIV1ErrorDefinition,
	type BlendCalcAPIV1ErrorCode,
} from "$lib/blendCalcAPI/v1/blendCalcAPIErrors";

const MAX_QUERY_LENGTH = 120;

export const BLENDCALC_API_V1_PAGINATION_LIMITS = Object.freeze({
	search: Object.freeze({ defaultLimit: 15, maximumLimit: 50 }),
	categories: Object.freeze({ defaultLimit: 50, maximumLimit: 100 }),
	revisions: Object.freeze({ defaultLimit: 25, maximumLimit: 100 }),
	maximumOffset: 1000,
});

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
		limit: readWholeNumber(
			url,
			"limit",
			BLENDCALC_API_V1_PAGINATION_LIMITS.search.defaultLimit,
			1,
			BLENDCALC_API_V1_PAGINATION_LIMITS.search.maximumLimit,
		),
		offset: readWholeNumber(
			url,
			"offset",
			0,
			0,
			BLENDCALC_API_V1_PAGINATION_LIMITS.maximumOffset,
		),
	};
};

export const readBlendCalcAPIV1CategoryRequest = (url: URL) => ({
	limit: readWholeNumber(
		url,
		"limit",
		BLENDCALC_API_V1_PAGINATION_LIMITS.categories.defaultLimit,
		1,
		BLENDCALC_API_V1_PAGINATION_LIMITS.categories.maximumLimit,
	),
	offset: readWholeNumber(
		url,
		"offset",
		0,
		0,
		BLENDCALC_API_V1_PAGINATION_LIMITS.maximumOffset,
	),
});

export const readBlendCalcAPIV1RevisionHistoryRequest = (url: URL) => ({
	limit: readWholeNumber(
		url,
		"limit",
		BLENDCALC_API_V1_PAGINATION_LIMITS.revisions.defaultLimit,
		1,
		BLENDCALC_API_V1_PAGINATION_LIMITS.revisions.maximumLimit,
	),
	offset: readWholeNumber(
		url,
		"offset",
		0,
		0,
		BLENDCALC_API_V1_PAGINATION_LIMITS.maximumOffset,
	),
});
