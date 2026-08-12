import {
	ApiV1RequestError,
	readApiV1RevisionHistoryRequest,
} from "$lib/api/v1/request";
import { readApiV1ProductRevisionHistory } from "$lib/server/api/v1/catalogApi.server";
import { hasApiV1CatalogReadAccess } from "$lib/server/api/v1/apiV1AccessPolicy.server";
import { apiV1Error, apiV1Success } from "$lib/server/api/v1/http.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!await hasApiV1CatalogReadAccess(locals)) {
		return apiV1Error("authentication_required");
	}
	const barcode = normalizeBarcode(params.barcode);
	if (!barcode) {
		return apiV1Error("invalid_barcode");
	}
	let request: ReturnType<typeof readApiV1RevisionHistoryRequest>;
	try {
		request = readApiV1RevisionHistoryRequest(url);
	} catch (error) {
		if (error instanceof ApiV1RequestError) {
			return apiV1Error(error.code, error.message);
		}
		throw error;
	}
	try {
		const result = await readApiV1ProductRevisionHistory(
			getSupabaseAdminClient(),
			barcode,
			request,
		);
		if (!result) {
			return apiV1Error("product_not_found");
		}
		return apiV1Success(result.revisions, result.pagination);
	} catch (error) {
		console.error("blendCalc API v1 revision-history read failed.", error);
		return apiV1Error("catalog_unavailable");
	}
};
