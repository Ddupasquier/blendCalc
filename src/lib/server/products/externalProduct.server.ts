import {
	type BarcodeProductDraft,
} from "$lib/utils/barcode/productLookup";
import type { FoodImageAsset } from "$lib/utils/food/types";
import { getProductReferenceCatalog } from "./productReferenceCatalog.server";
import {
	applyCachedImageToBarcodeDraft,
	mergeMissingBarcodeProductFields,
	needsAlcoholBarcodeProductSupplement,
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

const getRegulatedAlcoholDisclosureProfileKeys = async () => {
	const catalog = await getNutritionCompletenessCatalog();
	return (catalog.regulatoryDisclosureProfiles ?? [])
		.filter((profile) => profile.disclosureKind === "regulated-alcohol")
		.map((profile) => profile.key);
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
		regulatedAlcoholProfileKeys?:
			| Iterable<string>
			| PromiseLike<Iterable<string>>;
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
	const regulatedAlcoholProfileKeysPromise: Promise<Iterable<string>> =
		lookups.regulatedAlcoholProfileKeys !== undefined
			? Promise.resolve(lookups.regulatedAlcoholProfileKeys)
			: hasInjectedProvider
				? Promise.resolve([])
				: getRegulatedAlcoholDisclosureProfileKeys();
	void regulatedAlcoholProfileKeysPromise.catch(() => undefined);
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
	const applyAlcoholSupplement = async (draft: BarcodeProductDraft) => {
		const regulatedAlcoholProfileKeys =
			await regulatedAlcoholProfileKeysPromise.catch(() => []);
		if (
			!needsAlcoholBarcodeProductSupplement(
				draft,
				regulatedAlcoholProfileKeys,
			)
		) {
			return draft;
		}
		try {
			return mergeMissingBarcodeProductFields(
				draft,
				await lookupColaCloud(barcode, productReferenceCatalog),
			);
		} catch {
			return draft;
		}
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
				return applyAlcoholSupplement(primaryDraft);
			}
			try {
				const supplement = await lookupOpenFoodFacts(barcode, productReferenceCatalog);
				return applyAlcoholSupplement(
					mergeMissingBarcodeProductFields(primaryDraft, supplement),
				);
			} catch {
				return applyAlcoholSupplement(primaryDraft);
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
		if (openFoodFactsDraft) {
			const draftWithCachedImage = await applyCachedImage(openFoodFactsDraft);
			return draftWithCachedImage
				? applyAlcoholSupplement(draftWithCachedImage)
				: null;
		}
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
