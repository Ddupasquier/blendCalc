import {
	getBarcodeLookupCandidates,
	normalizeBarcode,
} from "$lib/utils/barcode/barcode";
import {
	mapFdcBarcodeFood,
	mapOpenFoodFactsProduct,
	type BarcodeProductDraft,
	type OpenFoodFactsResponse,
} from "$lib/utils/barcode/productLookup";
import type { FdcFood, FdcSearchResponse } from "$lib/utils/food/types";
import { APP_USER_AGENT } from "$lib/config/brand";
import { getUsdaFoodById, searchUsdaBrandedFoods } from "./usdaCache.server";
import { getProductReferenceData } from "./productReferenceData.server";
import type { ProductReferenceData } from "$lib/utils/food/reference/productReferenceData";

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

	for (const candidate of getBarcodeLookupCandidates(barcode)) {
		const searchData: FdcSearchResponse = await searchUsdaBrandedFoods(candidate);
		const match = (searchData.foods ?? []).find(
			(food) => food.gtinUpc && normalizeBarcode(food.gtinUpc) === canonicalBarcode,
		);
		if (!match) continue;

		let food: FdcFood;
		try {
			food = await getUsdaFoodById(match.fdcId);
		} catch {
			food = match;
		}

		return mapFdcBarcodeFood(
			food,
			canonicalBarcode,
			referenceData ?? await getProductReferenceData(),
		);
	}

	return null;
};

export const lookupOpenFoodFactsBarcodeProduct = async (
	barcode: string,
	referenceData?: ProductReferenceData,
): Promise<BarcodeProductDraft | null> => {
	const canonicalBarcode = normalizeBarcode(barcode);
	if (!canonicalBarcode) return null;

	for (const candidate of getBarcodeLookupCandidates(barcode)) {
		const url = new URL(
			`${OPEN_FOOD_FACTS_URL}/${encodeURIComponent(candidate)}.json`,
		);
		url.searchParams.set("fields", OPEN_FOOD_FACTS_FIELDS);
		const response = await fetch(url, {
			headers: {
				accept: "application/json",
				"user-agent": PRODUCT_LOOKUP_USER_AGENT,
			},
		});
		if (!response.ok) {
			if (response.status === 404) continue;
			throw new Error(
				`Open Food Facts lookup failed with ${response.status}.`,
			);
		}

		const data = await response.json() as OpenFoodFactsResponse;
		if (data.status !== 1 || !data.product) continue;
		const draft = mapOpenFoodFactsProduct(
			data.product,
			canonicalBarcode,
			referenceData ?? await getProductReferenceData(),
		);
		if (draft) return draft;
	}

	return null;
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
