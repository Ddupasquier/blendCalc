import {
	getSharedProductByBarcode,
} from "$lib/server/products/catalog.server";
import { resolveBarcodeDraftCategory } from "$lib/server/products/categoryMapping.server";
import { lookupExternalBarcodeProduct } from "$lib/server/products/externalProduct.server";
import { persistFoodImageAsset } from "$lib/server/products/foodImages.server";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import { mapSharedCatalogFood } from "$lib/utils/barcode/productLookup";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params }) => {
	const { user } = await locals.safeGetSession();
	if (!user) throw error(401, "Sign in to scan products.");

	const barcode = normalizeBarcode(params.barcode);
	if (!barcode) throw error(400, "Invalid barcode.");

	const sharedFood = await getSharedProductByBarcode(locals.supabase, barcode);
	if (sharedFood) {
		const draft = mapSharedCatalogFood(sharedFood, barcode);
		if (draft) {
			await persistFoodImageAsset({
				image: draft.image,
				barcode,
				sharedProductId: sharedFood.sharedProductId,
			});
			return json({
				status: "found",
				draft: await resolveBarcodeDraftCategory(locals.supabase, draft),
			});
		}
	}

	const draft = await lookupExternalBarcodeProduct(barcode);
	if (!draft) throw error(404, "Product not found.");
	await persistFoodImageAsset({ image: draft.image, barcode });
	return json({
		status: "found",
		draft: await resolveBarcodeDraftCategory(locals.supabase, draft),
	});
};
