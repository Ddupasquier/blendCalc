import {
	BLENDCALC_API_V1,
	type ApiV1Error,
	type ApiV1Pagination,
	type ApiV1Success,
} from "$lib/api/v1/types";
import {
	isApiV1Pathname,
	readApiV1ErrorDefinition,
	type ApiV1ErrorCode,
} from "$lib/api/v1/errors";
import { json } from "@sveltejs/kit";

const API_V1_HEADERS = {
	"cache-control": "private, max-age=60, stale-while-revalidate=300",
	"x-blendcalc-api-version": BLENDCALC_API_V1,
};

export const apiV1Success = <Data>(
	data: Data,
	pagination?: ApiV1Pagination,
) => json({
	apiVersion: BLENDCALC_API_V1,
	data,
	...(pagination ? { meta: { pagination } } : {}),
} satisfies ApiV1Success<Data>, { headers: API_V1_HEADERS });

export const apiV1Error = (
	code: ApiV1ErrorCode,
	message?: string,
	additionalHeaders?: HeadersInit,
) => {
	const definition = readApiV1ErrorDefinition(code);
	return json({
	apiVersion: BLENDCALC_API_V1,
	error: { code, message: message ?? definition.message },
} satisfies ApiV1Error, {
	status: definition.status,
	headers: {
		...API_V1_HEADERS,
		"cache-control": "private, no-store",
		...Object.fromEntries(new Headers(additionalHeaders)),
	},
	});
};

const readBoundaryErrorCode = (status: number): ApiV1ErrorCode => {
	if (status === 400) return "invalid_request";
	if (status === 401) return "authentication_required";
	if (status === 403) return "access_denied";
	if (status === 404) return "resource_not_found";
	if (status === 405) return "method_not_allowed";
	if (status === 429) return "rate_limited";
	if (status === 503) return "service_unavailable";
	return "unexpected_error";
};

export const normalizeApiV1BoundaryResponse = (
	pathname: string,
	response: Response,
) => {
	if (
		!isApiV1Pathname(pathname) ||
		response.status < 400 ||
		response.headers.has("x-blendcalc-api-version")
	) {
		return response;
	}

	const safeHeaders = new Headers();
	for (const headerName of ["allow", "retry-after", "x-ratelimit-remaining"]) {
		const headerValue = response.headers.get(headerName);
		if (headerValue) safeHeaders.set(headerName, headerValue);
	}

	return apiV1Error(
		readBoundaryErrorCode(response.status),
		undefined,
		safeHeaders,
	);
};
