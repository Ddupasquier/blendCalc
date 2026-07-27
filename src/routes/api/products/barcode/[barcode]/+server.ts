import { lookupBarcodeProductDraft } from "$lib/server/products/barcodeProduct.server";
import { persistFoodImageAsset } from "$lib/server/products/foodImages.server";
import {
	requireAppValue,
	throwAppError,
} from "$lib/server/errors/appError.server";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = await locals.getVerifiedUser();
	if (!user) throwAppError(401, "AUTH_REQUIRED");

	const barcode = requireAppValue(
		normalizeBarcode(params.barcode),
		400,
		"INVALID_BARCODE",
	);

	const draft = requireAppValue(
		await lookupBarcodeProductDraft(locals.supabase, barcode),
		404,
		"PRODUCT_NOT_FOUND",
	);
	await persistFoodImageAsset({
		image: draft.image,
		barcode,
		sharedProductId:
			draft.source === "shared-catalog"
				? draft.sourceReference
				: undefined,
	});
	return json({
		status: "found",
		draft,
	});
};
