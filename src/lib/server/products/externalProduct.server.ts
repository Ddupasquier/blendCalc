import {
	type BarcodeProductDraft,
} from "$lib/utils/barcode/productLookup";
import type { FoodImageAsset } from "$lib/utils/food/types";
import { getProductReferenceCatalog } from "./productReferenceCatalog.server";
import {
	applyCachedImageToBarcodeDraft,
	mergeMissingBarcodeProductFields,
	needsBarcodeProductSupplement,
} from "$lib/utils/barcode/barcodeProductEnrichment";
import { getNutritionCompletenessCatalog } from "$lib/server/nutrition/nutritionCompletenessCatalog.server";
import { lookupUsdaBarcodeProduct } from "$lib/server/products/sources/usdaBarcodeProduct.server";
import { lookupOpenFoodFactsBarcodeProduct } from "$lib/server/products/sources/openFoodFactsBarcodeProduct.server";
import { areExternalProductLookupsEnabled } from "./externalProductPolicy.server";

export { lookupUsdaBarcodeProduct, lookupOpenFoodFactsBarcodeProduct };

export const getRequiredPackagedNutrientIds = async () => {
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
		getProductReferenceCatalog?: typeof getProductReferenceCatalog;
		requiredNutrientIds?: Iterable<number>;
		cachedImage?: FoodImageAsset | null | PromiseLike<FoodImageAsset | null>;
		externalLookupsEnabled?: boolean;
	} = {},
): Promise<BarcodeProductDraft | null> => {
	const hasInjectedProvider = Boolean(lookups.usda || lookups.openFoodFacts);
	const externalLookupsEnabled = lookups.externalLookupsEnabled ??
		areExternalProductLookupsEnabled();
	if (!hasInjectedProvider && !externalLookupsEnabled) return null;

	const productReferenceCatalog = await (
		lookups.getProductReferenceCatalog ?? getProductReferenceCatalog
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
			lookupUsda(barcode, productReferenceCatalog),
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
				const supplement = await lookupOpenFoodFacts(barcode, productReferenceCatalog);
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
			lookupOpenFoodFacts(barcode, productReferenceCatalog),
			cachedImagePromise,
		]);
		return openFoodFactsDraft
			? applyCachedImageToBarcodeDraft(openFoodFactsDraft, cachedImage)
			: null;
	} catch (error) {
		throw firstError ?? error;
	}
};
