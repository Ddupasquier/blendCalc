import { lookupBarcodeProductDraft } from "$lib/server/products/barcodeProduct.server";
import { persistFoodImageAsset } from "$lib/server/products/foodImages.server";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params }) => {
	const { user } = await locals.safeGetSession();
	if (!user) throw error(401, "Sign in to scan products.");

	const barcode = normalizeBarcode(params.barcode);
	if (!barcode) throw error(400, "Invalid barcode.");

	const draft = await lookupBarcodeProductDraft(locals.supabase, barcode);
	if (!draft) throw error(404, "Product not found.");
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
