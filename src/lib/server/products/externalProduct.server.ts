import { env } from "$env/dynamic/private";
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
import { normalizeFdcFood } from "$lib/utils/food/fdc";
import type { FdcFood, FdcSearchResponse } from "$lib/utils/food/types";

const FDC_BASE_URL = "https://api.nal.usda.gov/fdc/v1";
const OPEN_FOOD_FACTS_URL = "https://world.openfoodfacts.org/api/v2/product";
const OPEN_FOOD_FACTS_FIELDS = [
	"code",
	"product_name",
	"generic_name",
	"brands",
	"serving_size",
	"serving_quantity",
	"serving_quantity_unit",
	"nutriments",
].join(",");
const PRODUCT_LOOKUP_USER_AGENT =
	"SmoothieMixer/1.0 (https://smoothie-mixer.vercel.app)";

const getFdcApiKey = () =>
	env.FDC_API_KEY?.trim() || env.VITE_FDC_API_KEY?.trim() || null;

const buildFdcUrl = (path: string, params: Record<string, string> = {}) => {
	const apiKey = getFdcApiKey();
	if (!apiKey) return null;

	const url = new URL(`${FDC_BASE_URL}${path}`);
	url.searchParams.set("api_key", apiKey);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}
	return url;
};

export const lookupUsdaBarcodeProduct = async (
	barcode: string,
): Promise<BarcodeProductDraft | null> => {
	const canonicalBarcode = normalizeBarcode(barcode);
	if (!canonicalBarcode) return null;

	for (const candidate of getBarcodeLookupCandidates(barcode)) {
		const searchUrl = buildFdcUrl("/foods/search", {
			query: candidate,
			dataType: "Branded",
			pageSize: "25",
		});
		if (!searchUrl) return null;

		const searchResponse = await fetch(searchUrl, {
			headers: { accept: "application/json" },
		});
		if (!searchResponse.ok) {
			throw new Error(`USDA barcode search failed with ${searchResponse.status}.`);
		}

		const searchData = await searchResponse.json() as FdcSearchResponse;
		const match = (searchData.foods ?? []).find(
			(food) => food.gtinUpc && normalizeBarcode(food.gtinUpc) === canonicalBarcode,
		);
		if (!match) continue;

		let food: FdcFood = normalizeFdcFood(match);
		const detailUrl = buildFdcUrl(`/food/${match.fdcId}`);
		if (detailUrl) {
			const detailResponse = await fetch(detailUrl, {
				headers: { accept: "application/json" },
			});
			if (detailResponse.ok) {
				food = normalizeFdcFood(await detailResponse.json());
			}
		}

		return mapFdcBarcodeFood(food, canonicalBarcode);
	}

	return null;
};

export const lookupOpenFoodFactsBarcodeProduct = async (
	barcode: string,
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
		const draft = mapOpenFoodFactsProduct(data.product, canonicalBarcode);
		if (draft) return draft;
	}

	return null;
};

export const lookupExternalBarcodeProduct = async (
	barcode: string,
): Promise<BarcodeProductDraft | null> => {
	let firstError: unknown;
	try {
		const usdaDraft = await lookupUsdaBarcodeProduct(barcode);
		if (usdaDraft) return usdaDraft;
	} catch (error) {
		firstError = error;
	}

	try {
		return await lookupOpenFoodFactsBarcodeProduct(barcode);
	} catch (error) {
		throw firstError ?? error;
	}
};
