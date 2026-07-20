import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import {
	mapFdcBarcodeFood,
	mapOpenFoodFactsProduct,
	type BarcodeProductDraft,
	type OpenFoodFactsResponse,
} from "$lib/utils/barcode/productLookup";
import type { FdcFood, FoodImageAsset } from "$lib/utils/food/types";
import { APP_USER_AGENT } from "$lib/config/brand";
import { getUsdaFoodById, searchUsdaBrandedFoods } from "./usdaCache.server";
import { getProductReferenceData } from "./productReferenceData.server";
import type { ProductReferenceData } from "$lib/utils/food/reference/productReferenceData";
import { selectPreferredUsdaBarcodeFood } from "$lib/server/products/usdaFoodSelection";
import {
	createProductSourceRequestTrace,
	recordProductSourceLookup,
} from "$lib/server/products/sourceMetrics.server";
import { summarizeBarcodeProductQuality } from "$lib/utils/food/sources/sourceQuality";
import { findFirstBarcodeCandidateMatch } from "$lib/server/products/barcodeCandidateLookup";
import { fetchCachedProductApiJson } from "$lib/server/products/productApiRequests.server";
import {
	applyCachedImageToBarcodeDraft,
	mergeMissingBarcodeProductFields,
	needsBarcodeProductSupplement,
} from "$lib/utils/barcode/barcodeProductEnrichment";
import { getNutritionCompletenessCatalog } from "$lib/server/nutrition/nutritionCompletenessCatalog.server";

const OPEN_FOOD_FACTS_URL = "https://world.openfoodfacts.org/api/v2/product";
const OPEN_FOOD_FACTS_FIELDS = [
	"code",
	"product_name",
	"generic_name",
	"brands",
	"ingredients_text",
	"ingredients_text_en",
	"allergens",
	"allergens_tags",
	"traces",
	"traces_tags",
	"labels",
	"labels_tags",
	"categories",
	"categories_tags",
	"categories_hierarchy",
	"food_groups",
	"food_groups_tags",
	"image_front_url",
	"image_front_small_url",
	"image_front_thumb_url",
	"image_url",
	"image_small_url",
	"image_thumb_url",
	"serving_size",
	"serving_quantity",
	"serving_quantity_unit",
	"nutriments",
].join(",");
const PRODUCT_LOOKUP_USER_AGENT = APP_USER_AGENT;
const OPEN_FOOD_FACTS_CACHE_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;
const OPEN_FOOD_FACTS_NOT_FOUND_CACHE_MILLISECONDS = 12 * 60 * 60 * 1000;
const OPEN_FOOD_FACTS_STALE_FALLBACK_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;

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

export const lookupUsdaBarcodeProduct = async (
	barcode: string,
	referenceData?: ProductReferenceData,
): Promise<BarcodeProductDraft | null> => {
	const canonicalBarcode = normalizeBarcode(barcode);
	if (!canonicalBarcode) return null;
	const startedAt = Date.now();
	const trace = createProductSourceRequestTrace();

	try {
		const candidateMatch = await findFirstBarcodeCandidateMatch(
			barcode,
			async (candidate) => {
				const searchResult = await searchUsdaBrandedFoods(candidate, trace);
				return selectPreferredUsdaBarcodeFood(
					searchResult.foods ?? [],
					canonicalBarcode,
				);
			},
		);
		const match = candidateMatch?.value ?? null;
		if (!match) {
			await recordProductSourceLookup({
				sourceKey: "usda",
				sourceDataType: "Branded",
				lookupKind: "barcode",
				outcome: "not-found",
				startedAt,
				trace,
			});
			return null;
		}

		let food: FdcFood;
		try {
			food = await getUsdaFoodById(match.fdcId, trace);
		} catch {
			food = match;
		}

		const draft = mapFdcBarcodeFood(
			food,
			canonicalBarcode,
			referenceData ?? await getProductReferenceData(),
		);
		await recordProductSourceLookup({
			sourceKey: "usda",
			sourceDataType: draft?.sourceDataType ?? "Branded",
			lookupKind: "barcode",
			outcome: draft ? "matched" : "not-found",
			startedAt,
			trace,
			quality: draft ? summarizeBarcodeProductQuality(draft) : undefined,
			exactBarcodeMatch: Boolean(draft),
		});
		return draft;
	} catch (error) {
		await recordProductSourceLookup({
			sourceKey: "usda",
			sourceDataType: "Branded",
			lookupKind: "barcode",
			outcome: "error",
			startedAt,
			trace,
		});
		throw error;
	}
};

export const lookupOpenFoodFactsBarcodeProduct = async (
	barcode: string,
	referenceData?: ProductReferenceData,
): Promise<BarcodeProductDraft | null> => {
	const canonicalBarcode = normalizeBarcode(barcode);
	if (!canonicalBarcode) return null;
	const startedAt = Date.now();
	const trace = createProductSourceRequestTrace();

	try {
		const candidateMatch = await findFirstBarcodeCandidateMatch(
			barcode,
			async (candidate) => {
				const url = new URL(
					`${OPEN_FOOD_FACTS_URL}/${encodeURIComponent(candidate)}.json`,
				);
				url.searchParams.set("fields", OPEN_FOOD_FACTS_FIELDS);
				const data = await fetchCachedProductApiJson<
					OpenFoodFactsResponse | null
				>({
					provider: "open-food-facts",
					requestKind: "barcode-product",
					cacheValue: { candidate, fields: OPEN_FOOD_FACTS_FIELDS },
					url,
					headers: {
						accept: "application/json",
						"user-agent": PRODUCT_LOOKUP_USER_AGENT,
					},
					ttlMilliseconds: OPEN_FOOD_FACTS_CACHE_MILLISECONDS,
					notFoundTtlMilliseconds:
						OPEN_FOOD_FACTS_NOT_FOUND_CACHE_MILLISECONDS,
					staleIfErrorMilliseconds:
						OPEN_FOOD_FACTS_STALE_FALLBACK_MILLISECONDS,
					notFoundStatusCodes: [404],
					notFoundValue: null,
					trace,
				});
				if (!data || data.status !== 1 || !data.product) return null;
				if (
					normalizeBarcode(data.product.code ?? candidate) !== canonicalBarcode
				) return null;
				return {
					draft: mapOpenFoodFactsProduct(
						data.product,
						canonicalBarcode,
						referenceData ?? await getProductReferenceData(),
					),
				};
			},
		);
		const draft = candidateMatch?.value.draft ?? null;
		if (draft) {
			await recordProductSourceLookup({
				sourceKey: "open-food-facts",
				lookupKind: "barcode",
				outcome: "matched",
				startedAt,
				trace,
				quality: summarizeBarcodeProductQuality(draft),
				exactBarcodeMatch: true,
			});
			return draft;
		}

		await recordProductSourceLookup({
			sourceKey: "open-food-facts",
			lookupKind: "barcode",
			outcome: "not-found",
			startedAt,
			trace,
		});
		return null;
	} catch (error) {
		await recordProductSourceLookup({
			sourceKey: "open-food-facts",
			lookupKind: "barcode",
			outcome: "error",
			startedAt,
			trace,
		});
		throw error;
	}
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
