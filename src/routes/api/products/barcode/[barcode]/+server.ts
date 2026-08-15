import { lookupBarcodeProductDraft } from "$lib/server/products/barcodeProduct.server";
import { persistFoodImageAsset } from "$lib/server/products/foodImages.server";
import {
	requireAppValue,
	throwAppError,
} from "$lib/server/errors/appError.server";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { completeServerBackgroundTask } from "$lib/server/runtime/backgroundTask.server";
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
		await lookupBarcodeProductDraft(getSupabaseAdminClient(), barcode),
		404,
		"PRODUCT_NOT_FOUND",
	);
	await completeServerBackgroundTask(persistFoodImageAsset({
		image: draft.image,
		barcode,
		productName: draft.name,
		brandName: draft.brandOwner,
		sharedProductId:
			draft.source === "shared-catalog"
				? draft.sourceReference
				: undefined,
	}).catch((error) => {
		console.warn(
			"Food image cache could not be updated after barcode lookup.",
			error instanceof Error ? error.message : error,
		);
	}));
	return json({
		status: "found",
		draft,
	});
};
