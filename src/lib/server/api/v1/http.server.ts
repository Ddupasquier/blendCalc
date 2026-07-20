import {
	BLENDCALC_API_V1,
	type ApiV1Error,
	type ApiV1Pagination,
	type ApiV1Success,
} from "$lib/api/v1/types";
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
	status: number,
	code: string,
	message: string,
) => json({
	apiVersion: BLENDCALC_API_V1,
	error: { code, message },
} satisfies ApiV1Error, {
	status,
	headers: {
		...API_V1_HEADERS,
		"cache-control": "private, no-store",
	},
});
