import {
	type BarcodeProductDraft,
} from "$lib/utils/barcode/productLookup";
import type { FoodImageAsset } from "$lib/utils/food/types";
import { getProductReferenceData } from "./productReferenceData.server";
import {
	applyCachedImageToBarcodeDraft,
	mergeMissingBarcodeProductFields,
	needsBarcodeProductSupplement,
} from "$lib/utils/barcode/barcodeProductEnrichment";
import { getNutritionCompletenessCatalog } from "$lib/server/nutrition/nutritionCompletenessCatalog.server";
import { lookupUsdaBarcodeProduct } from "$lib/server/products/sources/usdaBarcodeProduct.server";
import { lookupOpenFoodFactsBarcodeProduct } from "$lib/server/products/sources/openFoodFactsBarcodeProduct.server";

export { lookupUsdaBarcodeProduct, lookupOpenFoodFactsBarcodeProduct };

const getRequiredPackagedNutrientIds = async () => {
	const catalog = await getNutritionCompletenessCatalog();
	const profiles = catalog.profiles.filter((profile) => profile.foodScope === "packaged");
	const profile = profiles.find(
		(item) => item.isDefault && item.regionCode === "US",
	) ?? profiles.find((item) => item.isDefault) ?? profiles[0];
	return profile?.nutrients
		.filter((nutrient) => nutrient.requirementLevel === "required")
		.map((nutrient) => nutrient.nutrientId) ?? [];
};

export const lookupExternalBarcodeProduct = async (
	barcode: string,
	lookups: {
		usda?: typeof lookupUsdaBarcodeProduct;
		openFoodFacts?: typeof lookupOpenFoodFactsBarcodeProduct;
		getReferenceData?: typeof getProductReferenceData;
		requiredNutrientIds?: Iterable<number>;
		cachedImage?: FoodImageAsset | null | PromiseLike<FoodImageAsset | null>;
	} = {},
): Promise<BarcodeProductDraft | null> => {
	const referenceData = await (
		lookups.getReferenceData ?? getProductReferenceData
	)();
	const lookupUsda = lookups.usda ?? lookupUsdaBarcodeProduct;
	const lookupOpenFoodFacts =
		lookups.openFoodFacts ?? lookupOpenFoodFactsBarcodeProduct;
	const requiredNutrientIds = lookups.requiredNutrientIds ??
		(lookups.usda || lookups.openFoodFacts
			? []
			: await getRequiredPackagedNutrientIds());
	const cachedImagePromise = Promise.resolve(lookups.cachedImage ?? null).catch(
		() => null,
	);
	let firstError: unknown;
	try {
		const [usdaDraft, cachedImage] = await Promise.all([
			lookupUsda(barcode, referenceData),
			cachedImagePromise,
		]);
		if (usdaDraft) {
			const primaryDraft = applyCachedImageToBarcodeDraft(
				usdaDraft,
				cachedImage,
			);
			if (!needsBarcodeProductSupplement(primaryDraft, requiredNutrientIds)) {
				return primaryDraft;
			}
			try {
				const supplement = await lookupOpenFoodFacts(barcode, referenceData);
				return mergeMissingBarcodeProductFields(primaryDraft, supplement);
			} catch {
				return primaryDraft;
			}
		}
	} catch (error) {
		firstError = error;
	}

	try {
		const [openFoodFactsDraft, cachedImage] = await Promise.all([
			lookupOpenFoodFacts(barcode, referenceData),
			cachedImagePromise,
		]);
		return openFoodFactsDraft
			? applyCachedImageToBarcodeDraft(openFoodFactsDraft, cachedImage)
			: null;
	} catch (error) {
		throw firstError ?? error;
	}
};
