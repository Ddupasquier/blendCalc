export const BLENDCALC_API_V1_ERROR_DEFINITIONS = {
	authentication_required: {
		status: 401,
		message: "Sign in to use the internal API.",
	},
	access_denied: {
		status: 403,
		message: "This account cannot access the requested API resource.",
	},
	invalid_request: {
		status: 400,
		message: "The request is invalid.",
	},
	invalid_barcode: {
		status: 400,
		message: "barcode must be a valid GTIN.",
	},
	invalid_query: {
		status: 400,
		message: "The search query is invalid.",
	},
	invalid_pagination: {
		status: 400,
		message: "The pagination values are invalid.",
	},
	product_not_found: {
		status: 404,
		message: "No approved blendCalc product matches this barcode.",
	},
	resource_not_found: {
		status: 404,
		message: "No API resource matches this request.",
	},
	method_not_allowed: {
		status: 405,
		message: "This API resource does not support that request method.",
	},
	rate_limited: {
		status: 429,
		message: "Too many API requests were made. Wait a moment and try again.",
	},
	catalog_unavailable: {
		status: 503,
		message: "The blendCalc catalog is temporarily unavailable.",
	},
	service_unavailable: {
		status: 503,
		message: "blendCalcAPI is temporarily unavailable.",
	},
	unexpected_error: {
		status: 500,
		message: "blendCalcAPI could not complete this request.",
	},
} as const;

export type BlendCalcAPIV1ErrorCode =
	keyof typeof BLENDCALC_API_V1_ERROR_DEFINITIONS;

export const readBlendCalcAPIV1ErrorDefinition = (
	code: BlendCalcAPIV1ErrorCode,
) => BLENDCALC_API_V1_ERROR_DEFINITIONS[code];

export const isBlendCalcAPIV1Pathname = (pathname: string) =>
	pathname === "/api/v1" || pathname.startsWith("/api/v1/");
