import {
	ApiV1RequestError,
	readApiV1CategoryRequest,
} from "$lib/api/v1/request";
import { readApiV1Categories } from "$lib/server/api/v1/catalogApi.server";
import { hasApiV1CatalogReadAccess } from "$lib/server/api/v1/apiV1AccessPolicy.server";
import { apiV1Error, apiV1Success } from "$lib/server/api/v1/http.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!(await hasApiV1CatalogReadAccess(locals))) {
		return apiV1Error("authentication_required");
	}
	let request: ReturnType<typeof readApiV1CategoryRequest>;
	try {
		request = readApiV1CategoryRequest(url);
	} catch (error) {
		if (error instanceof ApiV1RequestError) {
			return apiV1Error(error.code, error.message);
		}
		throw error;
	}
	try {
		const result = await readApiV1Categories(getSupabaseAdminClient(), request);
		return apiV1Success(result.categories, result.pagination);
	} catch (error) {
		console.error("blendCalcAPI v1 category read failed.", error);
		return apiV1Error("catalog_unavailable");
	}
};
