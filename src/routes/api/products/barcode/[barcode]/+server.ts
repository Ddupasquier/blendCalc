import {
	getSharedProductByBarcode,
} from "$lib/server/products/catalog.server";
import { lookupExternalBarcodeProduct } from "$lib/server/products/externalProduct.server";
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
		if (draft) return json({ status: "found", draft });
	}

	const draft = await lookupExternalBarcodeProduct(barcode);
	if (!draft) throw error(404, "Product not found.");
	return json({ status: "found", draft });
};
