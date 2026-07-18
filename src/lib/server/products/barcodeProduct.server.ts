import { getSharedProductByBarcode } from "$lib/server/products/catalog.server";
import { resolveBarcodeDraftCategory } from "$lib/server/products/categoryMapping.server";
import { lookupExternalBarcodeProduct } from "$lib/server/products/externalProduct.server";
import { getProductReferenceData } from "$lib/server/products/productReferenceData.server";
import type { Database } from "$lib/types/database.types";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import {
	mapSharedCatalogFood,
	type BarcodeProductDraft,
} from "$lib/utils/barcode/productLookup";
import { getCachedFoodImageByBarcode } from "$lib/utils/storage/supabase/foodImages";
import type { SupabaseClient } from "@supabase/supabase-js";

export const lookupBarcodeProductDraft = async (
	supabase: SupabaseClient<Database>,
	barcodeValue: string,
): Promise<BarcodeProductDraft | null> => {
	const barcode = normalizeBarcode(barcodeValue);
	if (!barcode) return null;
	const cachedImagePromise = getCachedFoodImageByBarcode(supabase, barcode);

	const sharedFood = await getSharedProductByBarcode(supabase, barcode);
	if (sharedFood) {
		const [referenceData, cachedImage] = await Promise.all([
			getProductReferenceData(),
			cachedImagePromise,
		]);
		const mappedDraft = mapSharedCatalogFood(sharedFood, barcode, referenceData);
		const draft = mappedDraft && cachedImage
			? { ...mappedDraft, image: cachedImage }
			: mappedDraft;
		return draft
			? await resolveBarcodeDraftCategory(supabase, draft)
			: null;
	}

	const draft = await lookupExternalBarcodeProduct(barcode, {
		cachedImage: cachedImagePromise,
	});
	return draft
		? await resolveBarcodeDraftCategory(supabase, draft)
		: null;
};
