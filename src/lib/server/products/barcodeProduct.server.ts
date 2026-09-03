import { getSharedProductByBarcode } from "$lib/server/products/catalog.server";
import { resolveBarcodeDraftCategory } from "$lib/server/products/categoryMapping.server";
import { persistSharedProductExternalEnrichment } from "$lib/server/products/catalogEnrichment.server";
import {
	getRequiredPackagedNutrientIds,
	lookupExternalBarcodeProduct,
} from "$lib/server/products/externalProduct.server";
import { getProductReferenceCatalog } from "$lib/server/products/productReferenceCatalog.server";
import { getDefaultProductResolutionPolicy } from "$lib/server/products/productResolutionPolicy.server";
import { ensureServerServingMeasureCatalog } from "$lib/server/serving/servingMeasureCatalog.server";
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
	const cachedImagePromise = getCachedFoodImageByBarcode(
		supabase,
		barcode,
	).catch(() => null);

	const [sharedFood] = await Promise.all([
		getSharedProductByBarcode(supabase, barcode),
		ensureServerServingMeasureCatalog(),
	]);
	if (sharedFood) {
		const resolvedBarcode =
			normalizeBarcode(sharedFood.barcode ?? sharedFood.gtinUpc ?? "") ??
			barcode;
		const [
			productReferenceCatalog,
			cachedImage,
			requiredNutrientIds,
			resolutionPolicy,
		] = await Promise.all([
			getProductReferenceCatalog(),
			cachedImagePromise,
			getRequiredPackagedNutrientIds(sharedFood),
			getDefaultProductResolutionPolicy().catch(() => null),
		]);
		const mappedDraft = mapSharedCatalogFood(
			sharedFood,
			resolvedBarcode,
			productReferenceCatalog,
		);
		if (mappedDraft) {
			const cachedDraft = applyCachedImageToBarcodeDraft(
				mappedDraft,
				cachedImage,
			);
			let draft = cachedDraft;
			let supplementedFields = [] as ReturnType<
				typeof getSupplementedBarcodeProductFields
			>;
			if (needsBarcodeProductSupplement(cachedDraft, requiredNutrientIds)) {
				try {
					const supplement = await lookupExternalBarcodeProduct(
						resolvedBarcode,
						{
							cachedImage,
							getProductReferenceCatalog: async () => productReferenceCatalog,
							requiredNutrientIds,
						},
					);
					supplementedFields = getSupplementedBarcodeProductFields(
						cachedDraft,
						supplement,
						resolutionPolicy?.nutrientRelationshipRules,
					);
					draft = mergeMissingBarcodeProductFields(
						cachedDraft,
						supplement,
						resolutionPolicy?.nutrientRelationshipRules,
					);
				} catch {
					draft = cachedDraft;
				}
			}
			const resolvedDraft = await resolveBarcodeDraftCategory(supabase, draft);
			if (supplementedFields.length > 0 && mappedDraft.sourceReference) {
				await persistSharedProductExternalEnrichment({
					sharedProductId: mappedDraft.sourceReference,
					barcode: resolvedBarcode,
					currentFood: sharedFood,
					enrichedDraft: resolvedDraft,
					fields: supplementedFields,
					productReferenceCatalog,
				});
			}
			return resolvedDraft;
		}
	}

	const draft = await lookupExternalBarcodeProduct(barcode, {
		cachedImage: cachedImagePromise,
	});
	return draft ? await resolveBarcodeDraftCategory(supabase, draft) : null;
};
