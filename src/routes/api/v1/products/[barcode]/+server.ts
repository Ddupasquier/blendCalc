import {
	BlendCalcAPIV1RequestError,
	readBlendCalcAPIV1BarcodePathParameter,
	readBlendCalcAPIV1ProductRequest,
} from "$lib/blendCalcAPI/v1/blendCalcAPIRequest";
import {
	blendCalcAPIV1Error,
	blendCalcAPIV1Success,
} from "$lib/server/blendCalcAPI/v1/blendCalcAPIHttp.server";
import {
	isBlendCalcAPIV1RequestTimeoutError,
	runBlendCalcAPIV1RequestWithinDeadline,
} from "$lib/server/blendCalcAPI/v1/blendCalcAPIRequestBoundary.server";
import { hasBlendCalcAPIV1CatalogReadAccess } from "$lib/server/blendCalcAPI/v1/blendCalcAPIAccessPolicy.server";
import { readBlendCalcAPIV1ProductByBarcode } from "$lib/server/blendCalcAPI/v1/blendCalcAPIReadModel.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params, request, url }) => {
	if (!(await hasBlendCalcAPIV1CatalogReadAccess(locals))) {
		return blendCalcAPIV1Error("authentication_required");
	}
	let barcode: string;
	try {
		barcode = readBlendCalcAPIV1BarcodePathParameter(params.barcode);
		readBlendCalcAPIV1ProductRequest(url);
	} catch (error) {
		if (error instanceof BlendCalcAPIV1RequestError) {
			return blendCalcAPIV1Error(error.code, error.message);
		}
		throw error;
	}
	try {
		const product = await runBlendCalcAPIV1RequestWithinDeadline(
			(databaseAbortSignal) =>
				readBlendCalcAPIV1ProductByBarcode(getSupabaseAdminClient(), barcode, {
					databaseAbortSignal,
				}),
		);
		if (!product) return blendCalcAPIV1Error("product_not_found");
		return blendCalcAPIV1Success(product, undefined, {
			ifNoneMatch: request?.headers.get("if-none-match"),
		});
	} catch (error) {
		if (isBlendCalcAPIV1RequestTimeoutError(error)) {
			return blendCalcAPIV1Error("service_unavailable");
		}
		console.error("blendCalcAPI v1 product read failed.", error);
		return blendCalcAPIV1Error("catalog_unavailable");
	}
};
