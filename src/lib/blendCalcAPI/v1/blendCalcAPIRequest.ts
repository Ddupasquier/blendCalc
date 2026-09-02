import {
	readBlendCalcAPIV1ErrorDefinition,
	type BlendCalcAPIV1ErrorCode,
} from "$lib/blendCalcAPI/v1/blendCalcAPIErrors";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";

const MAX_QUERY_LENGTH = 120;
const MAXIMUM_QUERY_STRING_LENGTH = 2_048;
const SEARCH_QUERY_PARAMETERS = new Set(["q", "limit", "offset"]);
const PAGINATED_QUERY_PARAMETERS = new Set(["limit", "offset"]);
const NO_QUERY_PARAMETERS = new Set<string>();
const CANONICAL_WHOLE_NUMBER_PATTERN = /^(?:0|[1-9]\d*)$/;
const STRICT_GTIN_PATTERN = /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/;
const UNSAFE_SEARCH_CHARACTER_PATTERN =
	/[\p{Cc}\u200B\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/u;

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

const assertExpectedQueryParameters = (
	url: URL,
	expectedParameters: ReadonlySet<string>,
) => {
	if (url.search.length > MAXIMUM_QUERY_STRING_LENGTH) {
		throw new BlendCalcAPIV1RequestError(
			"invalid_request",
			"The query string is too long.",
		);
	}

	const receivedParameters = new Set<string>();
	for (const [parameter] of url.searchParams) {
		if (
			!expectedParameters.has(parameter) ||
			receivedParameters.has(parameter)
		) {
			throw new BlendCalcAPIV1RequestError(
				"invalid_request",
				`Unexpected or repeated query parameter: ${parameter}.`,
			);
		}
		receivedParameters.add(parameter);
	}
};

const readWholeNumber = (
	url: URL,
	key: string,
	fallback: number,
	minimum: number,
	maximum: number,
) => {
	const rawValue = url.searchParams.get(key);
	if (rawValue === null) return fallback;
	if (!CANONICAL_WHOLE_NUMBER_PATTERN.test(rawValue)) {
		throw new BlendCalcAPIV1RequestError(
			"invalid_pagination",
			`${key} must be a whole number between ${minimum} and ${maximum}.`,
		);
	}
	const value = Number(rawValue);
	if (!Number.isInteger(value) || value < minimum || value > maximum) {
		throw new BlendCalcAPIV1RequestError(
			"invalid_pagination",
			`${key} must be a whole number between ${minimum} and ${maximum}.`,
		);
	}
	return value;
};

export const readBlendCalcAPIV1BarcodePathParameter = (value: string) => {
	if (!STRICT_GTIN_PATTERN.test(value)) {
		throw new BlendCalcAPIV1RequestError("invalid_barcode");
	}
	const barcode = normalizeBarcode(value);
	if (!barcode) {
		throw new BlendCalcAPIV1RequestError("invalid_barcode");
	}
	return barcode;
};

export const readBlendCalcAPIV1SearchRequest = (url: URL) => {
	assertExpectedQueryParameters(url, SEARCH_QUERY_PARAMETERS);
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
	if (UNSAFE_SEARCH_CHARACTER_PATTERN.test(query)) {
		throw new BlendCalcAPIV1RequestError(
			"invalid_query",
			"q cannot contain control or formatting characters.",
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

export const readBlendCalcAPIV1CategoryRequest = (url: URL) => {
	assertExpectedQueryParameters(url, PAGINATED_QUERY_PARAMETERS);
	return {
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
	};
};

export const readBlendCalcAPIV1RevisionHistoryRequest = (url: URL) => {
	assertExpectedQueryParameters(url, PAGINATED_QUERY_PARAMETERS);
	return {
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
	};
};

export const readBlendCalcAPIV1ProductRequest = (url: URL) => {
	assertExpectedQueryParameters(url, NO_QUERY_PARAMETERS);
};
