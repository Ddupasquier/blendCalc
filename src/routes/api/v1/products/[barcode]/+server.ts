import { apiV1Error, apiV1Success } from "$lib/server/api/v1/http.server";
import { hasApiV1CatalogReadAccess } from "$lib/server/api/v1/apiV1AccessPolicy.server";
import { readApiV1ProductByBarcode } from "$lib/server/api/v1/catalogApi.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!await hasApiV1CatalogReadAccess(locals)) {
		return apiV1Error("authentication_required");
	}
	const barcode = normalizeBarcode(params.barcode);
	if (!barcode) return apiV1Error("invalid_barcode");
	try {
		const product = await readApiV1ProductByBarcode(
			getSupabaseAdminClient(),
			barcode,
		);
		if (!product) return apiV1Error("product_not_found");
		return apiV1Success(product);
	} catch (error) {
		console.error("blendCalc API v1 product read failed.", error);
		return apiV1Error("catalog_unavailable");
	}
};
