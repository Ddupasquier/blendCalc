import { ApiV1RequestError, readApiV1SearchRequest } from "$lib/api/v1/request";
import { searchApiV1Products } from "$lib/server/api/v1/catalogApi.server";
import { apiV1Error, apiV1Success } from "$lib/server/api/v1/http.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = await locals.getVerifiedUser();
	if (!user) return apiV1Error(401, "authentication_required", "Sign in to use the internal API.");
	try {
		const request = readApiV1SearchRequest(url);
		const result = await searchApiV1Products(getSupabaseAdminClient(), request);
		return apiV1Success(result.products, result.pagination);
	} catch (error) {
		if (error instanceof ApiV1RequestError) {
			return apiV1Error(error.status, error.code, error.message);
		}
		console.error("blendCalc API v1 product search failed.", error);
		return apiV1Error(503, "catalog_unavailable", "The blendCalc catalog is temporarily unavailable.");
	}
};
