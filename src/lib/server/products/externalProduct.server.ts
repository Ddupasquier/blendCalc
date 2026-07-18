import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import {
	mapFdcBarcodeFood,
	mapOpenFoodFactsProduct,
	type BarcodeProductDraft,
	type OpenFoodFactsResponse,
} from "$lib/utils/barcode/productLookup";
import type { FdcFood } from "$lib/utils/food/types";
import { APP_USER_AGENT } from "$lib/config/brand";
import { getUsdaFoodById, searchUsdaBrandedFoods } from "./usdaCache.server";
import { getProductReferenceData } from "./productReferenceData.server";
import type { ProductReferenceData } from "$lib/utils/food/reference/productReferenceData";
import { selectPreferredUsdaBarcodeFood } from "$lib/server/products/usdaFoodSelection";
import {
	createProductSourceRequestTrace,
	recordProductSourceApiError,
	recordProductSourceApiRequest,
	recordProductSourceLookup,
} from "$lib/server/products/sourceMetrics.server";
import { summarizeBarcodeProductQuality } from "$lib/utils/food/sources/sourceQuality";
import { findFirstBarcodeCandidateMatch } from "$lib/server/products/barcodeCandidateLookup";
import { coalesceProductApiRequest } from "$lib/server/products/productApiRequests.server";

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
				const data = await coalesceProductApiRequest(
					`open-food-facts:barcode:${candidate}:${OPEN_FOOD_FACTS_FIELDS}`,
					async () => {
						recordProductSourceApiRequest(trace);
						let response: Response;
						try {
							response = await fetch(url, {
								headers: {
									accept: "application/json",
									"user-agent": PRODUCT_LOOKUP_USER_AGENT,
								},
							});
						} catch (error) {
							recordProductSourceApiError(trace);
							throw error;
						}
						if (!response.ok) {
							if (response.status === 404) return null;
							recordProductSourceApiError(trace);
							throw new Error(
								`Open Food Facts lookup failed with ${response.status}.`,
							);
						}
						return await response.json() as OpenFoodFactsResponse;
					},
					trace,
				);
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
): Promise<BarcodeProductDraft | null> => {
	const referenceData = await getProductReferenceData();
	let firstError: unknown;
	try {
		const usdaDraft = await lookupUsdaBarcodeProduct(barcode, referenceData);
		if (usdaDraft) return usdaDraft;
	} catch (error) {
		firstError = error;
	}

	try {
		return await lookupOpenFoodFactsBarcodeProduct(barcode, referenceData);
	} catch (error) {
		throw firstError ?? error;
	}
};
