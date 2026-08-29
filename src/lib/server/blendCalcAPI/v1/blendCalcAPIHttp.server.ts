import {
	BLENDCALC_API_V1,
	type BlendCalcAPIV1Error,
	type BlendCalcAPIV1Pagination,
	type BlendCalcAPIV1Success,
} from "$lib/blendCalcAPI/v1/blendCalcAPITypes";
import {
	isBlendCalcAPIV1Pathname,
	readBlendCalcAPIV1ErrorDefinition,
	type BlendCalcAPIV1ErrorCode,
} from "$lib/blendCalcAPI/v1/blendCalcAPIErrors";
import { createHash } from "node:crypto";
import { json } from "@sveltejs/kit";

const BLENDCALC_API_V1_HEADERS = {
	"x-blendcalc-api-version": BLENDCALC_API_V1,
};

type BlendCalcAPIV1SuccessOptions = {
	ifNoneMatch?: string | null;
	cacheVisibility?: "private" | "public";
};

export const blendCalcAPIV1Success = <Data>(
	data: Data,
	pagination?: BlendCalcAPIV1Pagination,
	options: BlendCalcAPIV1SuccessOptions = {},
) => {
	const payload = {
		apiVersion: BLENDCALC_API_V1,
		data,
		...(pagination ? { meta: { pagination } } : {}),
	} satisfies BlendCalcAPIV1Success<Data>;
	const etag = `"${createHash("sha256")
		.update(JSON.stringify(payload))
		.digest("base64url")}"`;
	const isPublic = options.cacheVisibility === "public";
	const headers = {
		...BLENDCALC_API_V1_HEADERS,
		"cache-control": isPublic
			? "public, max-age=60, s-maxage=300, stale-while-revalidate=300"
			: "private, max-age=60, stale-while-revalidate=300",
		etag,
		vary: isPublic ? "accept-encoding" : "authorization, accept-encoding",
	};
	if (
		options.ifNoneMatch
			?.split(",")
			.map((value) => value.trim())
			.includes(etag)
	) {
		return new Response(null, { status: 304, headers });
	}
	return json(payload, { headers });
};

export const blendCalcAPIV1Error = (
	code: BlendCalcAPIV1ErrorCode,
	message?: string,
	additionalHeaders?: HeadersInit,
) => {
	const definition = readBlendCalcAPIV1ErrorDefinition(code);
	return json(
		{
			apiVersion: BLENDCALC_API_V1,
			error: { code, message: message ?? definition.message },
		} satisfies BlendCalcAPIV1Error,
		{
			status: definition.status,
			headers: {
				...BLENDCALC_API_V1_HEADERS,
				"cache-control": "private, no-store",
				...Object.fromEntries(new Headers(additionalHeaders)),
			},
		},
	);
};

const readBoundaryErrorCode = (status: number): BlendCalcAPIV1ErrorCode => {
	if (status === 400) return "invalid_request";
	if (status === 401) return "authentication_required";
	if (status === 403) return "access_denied";
	if (status === 404) return "resource_not_found";
	if (status === 405) return "method_not_allowed";
	if (status === 429) return "rate_limited";
	if (status === 503) return "service_unavailable";
	return "unexpected_error";
};

export const normalizeBlendCalcAPIV1BoundaryResponse = (
	pathname: string,
	response: Response,
) => {
	if (
		!isBlendCalcAPIV1Pathname(pathname) ||
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

	return blendCalcAPIV1Error(
		readBoundaryErrorCode(response.status),
		undefined,
		safeHeaders,
	);
};
