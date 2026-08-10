import { ApiV1RequestError } from "$lib/api/v1/request";
import { apiV1Error, apiV1Success } from "$lib/server/api/v1/http.server";
import { readApiV1ProductByBarcode } from "$lib/server/api/v1/catalogApi.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = await locals.getVerifiedUser();
	if (!user) return apiV1Error(401, "authentication_required", "Sign in to use the internal API.");
	const barcode = normalizeBarcode(params.barcode);
	if (!barcode) return apiV1Error(400, "invalid_barcode", "barcode must be a valid GTIN.");
	try {
		const product = await readApiV1ProductByBarcode(
			getSupabaseAdminClient(),
			barcode,
		);
		if (!product) return apiV1Error(404, "product_not_found", "No approved blendCalc product matches this barcode.");
		return apiV1Success(product);
	} catch (error) {
		if (error instanceof ApiV1RequestError) {
			return apiV1Error(error.status, error.code, error.message);
		}
		console.error("blendCalc API v1 product read failed.", error);
		return apiV1Error(503, "catalog_unavailable", "The blendCalc catalog is temporarily unavailable.");
	}
};
