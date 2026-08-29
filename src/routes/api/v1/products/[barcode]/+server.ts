import {
	blendCalcAPIV1Error,
	blendCalcAPIV1Success,
} from "$lib/server/blendCalcAPI/v1/blendCalcAPIHttp.server";
import { hasBlendCalcAPIV1CatalogReadAccess } from "$lib/server/blendCalcAPI/v1/blendCalcAPIAccessPolicy.server";
import { readBlendCalcAPIV1ProductByBarcode } from "$lib/server/blendCalcAPI/v1/blendCalcAPICatalog.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params, request }) => {
	if (!(await hasBlendCalcAPIV1CatalogReadAccess(locals))) {
		return blendCalcAPIV1Error("authentication_required");
	}
	const barcode = normalizeBarcode(params.barcode);
	if (!barcode) return blendCalcAPIV1Error("invalid_barcode");
	try {
		const product = await readBlendCalcAPIV1ProductByBarcode(
			getSupabaseAdminClient(),
			barcode,
		);
		if (!product) return blendCalcAPIV1Error("product_not_found");
		return blendCalcAPIV1Success(product, undefined, {
			ifNoneMatch: request?.headers.get("if-none-match"),
		});
	} catch (error) {
		console.error("blendCalcAPI v1 product read failed.", error);
		return blendCalcAPIV1Error("catalog_unavailable");
	}
};
