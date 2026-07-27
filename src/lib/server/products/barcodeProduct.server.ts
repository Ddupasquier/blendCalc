import { getSharedProductByBarcode } from "$lib/server/products/catalog.server";
import { resolveBarcodeDraftCategory } from "$lib/server/products/categoryMapping.server";
import { persistSharedProductExternalEnrichment } from "$lib/server/products/catalogEnrichment.server";
import {
	getRequiredPackagedNutrientIds,
	lookupExternalBarcodeProduct,
} from "$lib/server/products/externalProduct.server";
import { getProductReferenceData } from "$lib/server/products/productReferenceData.server";
import type { Database } from "$lib/types/database.types";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import {
	mapSharedCatalogFood,
	type BarcodeProductDraft,
} from "$lib/utils/barcode/barcodeProductMappers";
import { getCachedFoodImageByBarcode } from "$lib/utils/storage/supabase/foodImages";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	applyCachedImageToBarcodeDraft,
	getSupplementedBarcodeProductFields,
	mergeMissingBarcodeProductFields,
	needsBarcodeProductSupplement,
} from "$lib/utils/barcode/barcodeProductEnrichment";

export const lookupBarcodeProductDraft = async (
	supabase: SupabaseClient<Database>,
	barcodeValue: string,
): Promise<BarcodeProductDraft | null> => {
	const barcode = normalizeBarcode(barcodeValue);
	if (!barcode) return null;
	const cachedImagePromise = getCachedFoodImageByBarcode(supabase, barcode).catch(
		() => null,
	);

	const sharedFood = await getSharedProductByBarcode(supabase, barcode);
	if (sharedFood) {
		const [referenceData, cachedImage] = await Promise.all([
			getProductReferenceData(),
			cachedImagePromise,
		]);
		const mappedDraft = mapSharedCatalogFood(sharedFood, barcode, referenceData);
		if (mappedDraft) {
			const cachedDraft = applyCachedImageToBarcodeDraft(
				mappedDraft,
				cachedImage,
			);
			let draft = cachedDraft;
			let supplementedFields = [] as ReturnType<
				typeof getSupplementedBarcodeProductFields
			>;
			const requiredNutrientIds = await getRequiredPackagedNutrientIds();
			if (needsBarcodeProductSupplement(cachedDraft, requiredNutrientIds)) {
				try {
					const supplement = await lookupExternalBarcodeProduct(barcode, {
						cachedImage,
						getReferenceData: async () => referenceData,
						requiredNutrientIds,
					});
					supplementedFields = getSupplementedBarcodeProductFields(
						cachedDraft,
						supplement,
					);
					draft = mergeMissingBarcodeProductFields(cachedDraft, supplement);
				} catch {
					draft = cachedDraft;
				}
			}
			const resolvedDraft = await resolveBarcodeDraftCategory(supabase, draft);
			if (supplementedFields.length > 0 && mappedDraft.sourceReference) {
				await persistSharedProductExternalEnrichment({
					sharedProductId: mappedDraft.sourceReference,
					barcode,
					currentFood: sharedFood,
					enrichedDraft: resolvedDraft,
					fields: supplementedFields,
					referenceData,
				});
			}
			return resolvedDraft;
		}
	}

	const draft = await lookupExternalBarcodeProduct(barcode, {
		cachedImage: cachedImagePromise,
	});
	return draft
		? await resolveBarcodeDraftCategory(supabase, draft)
		: null;
};
