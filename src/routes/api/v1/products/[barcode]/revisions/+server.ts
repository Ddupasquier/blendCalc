import {
	ApiV1RequestError,
	readApiV1RevisionHistoryRequest,
} from "$lib/api/v1/request";
import { readApiV1ProductRevisionHistory } from "$lib/server/api/v1/catalogApi.server";
import { apiV1Error, apiV1Success } from "$lib/server/api/v1/http.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const user = await locals.getVerifiedUser();
	if (!user) {
		return apiV1Error(
			401,
			"authentication_required",
			"Sign in to use the internal API.",
		);
	}
	const barcode = normalizeBarcode(params.barcode);
	if (!barcode) {
		return apiV1Error(
			400,
			"invalid_barcode",
			"barcode must be a valid GTIN.",
		);
	}
	try {
		const request = readApiV1RevisionHistoryRequest(url);
		const result = await readApiV1ProductRevisionHistory(
			getSupabaseAdminClient(),
			barcode,
			request,
		);
		if (!result) {
			return apiV1Error(
				404,
				"product_not_found",
				"No approved blendCalc product matches this barcode.",
			);
		}
		return apiV1Success(result.revisions, result.pagination);
	} catch (error) {
		if (error instanceof ApiV1RequestError) {
			return apiV1Error(error.status, error.code, error.message);
		}
		console.error("blendCalc API v1 revision-history read failed.", error);
		return apiV1Error(
			503,
			"catalog_unavailable",
			"The blendCalc catalog is temporarily unavailable.",
		);
	}
};
