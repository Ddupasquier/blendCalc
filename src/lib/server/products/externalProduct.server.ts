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
import { getNutritionCompletenessProfile } from "$lib/utils/food/quality/nutritionCompletenessCatalog";
import type { FoodItem } from "$lib/utils/food/types";
import { lookupUsdaBarcodeProduct } from "$lib/server/products/sources/usdaBarcodeProduct.server";
import { lookupOpenFoodFactsBarcodeProduct } from "$lib/server/products/sources/openFoodFactsBarcodeProduct.server";
import { lookupColaCloudBarcodeProduct } from "$lib/server/products/sources/colaCloudBarcodeProduct.server";
import { areExternalProductLookupsEnabled } from "./externalProductPolicy.server";

export {
	lookupUsdaBarcodeProduct,
	lookupOpenFoodFactsBarcodeProduct,
	lookupColaCloudBarcodeProduct,
};

export const getRequiredPackagedNutrientIds = async (food?: FoodItem) => {
	const catalog = await getNutritionCompletenessCatalog();
	const profiles = catalog.profiles.filter(
		(profile) => profile.foodScope === "packaged",
	);
	const profile = food
		? getNutritionCompletenessProfile(food, catalog)
		: profiles.find(
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
		colaCloud?: typeof lookupColaCloudBarcodeProduct;
		getProductReferenceCatalog?: typeof getProductReferenceCatalog;
		requiredNutrientIds?:
			| Iterable<number>
			| PromiseLike<Iterable<number>>;
		cachedImage?: FoodImageAsset | null | PromiseLike<FoodImageAsset | null>;
		externalLookupsEnabled?: boolean;
	} = {},
): Promise<BarcodeProductDraft | null> => {
	const hasInjectedProvider = Boolean(
		lookups.usda || lookups.openFoodFacts || lookups.colaCloud,
	);
	const externalLookupsEnabled = lookups.externalLookupsEnabled ??
		areExternalProductLookupsEnabled();
	if (!hasInjectedProvider && !externalLookupsEnabled) return null;

	const productReferenceCatalogPromise = (
		lookups.getProductReferenceCatalog ?? getProductReferenceCatalog
	)();
	const requiredNutrientIdsPromise: Promise<Iterable<number>> =
		lookups.requiredNutrientIds !== undefined
			? Promise.resolve(lookups.requiredNutrientIds)
			: hasInjectedProvider
				? Promise.resolve([])
				: getRequiredPackagedNutrientIds();
	void requiredNutrientIdsPromise.catch(() => undefined);
	const cachedImagePromise = Promise.resolve(lookups.cachedImage ?? null).catch(
		() => null,
	);
	const productReferenceCatalog = await productReferenceCatalogPromise;
	const lookupUsda = lookups.usda ?? lookupUsdaBarcodeProduct;
	const lookupOpenFoodFacts =
		lookups.openFoodFacts ?? lookupOpenFoodFactsBarcodeProduct;
	const lookupColaCloud = lookups.colaCloud ?? (
		hasInjectedProvider
			? async () => null
			: lookupColaCloudBarcodeProduct
	);
	const applyCachedImage = async (draft: BarcodeProductDraft | null) => {
		if (!draft) return null;
		return applyCachedImageToBarcodeDraft(draft, await cachedImagePromise);
	};
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
			const requiredNutrientIds = await requiredNutrientIdsPromise;
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
		const openFoodFactsDraft = await lookupOpenFoodFacts(
			barcode,
			productReferenceCatalog,
		);
		if (openFoodFactsDraft) return applyCachedImage(openFoodFactsDraft);
	} catch (error) {
		firstError ??= error;
	}

	try {
		return await applyCachedImage(
			await lookupColaCloud(barcode, productReferenceCatalog),
		);
	} catch (error) {
		throw firstError ?? error;
	}
};
