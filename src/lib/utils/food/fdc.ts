/**
 * FoodData Central (FDC) API client.
 * Docs: https://fdc.nal.usda.gov/api-guide.html
 *
 * Rate limit: 3,600 requests / hour with an API key.
 * All responses are cached in localStorage to minimise repeat calls.
 */

import { cacheGet, cacheSet } from "$lib/cache";
import { getBarcodeLookupCandidates, normalizeBarcode } from "$lib/utils/barcode/barcode";
import type { FdcFood, FdcNutrient, FdcSearchResponse } from "$lib/utils/food/types";

type FdcDetailNutrient = {
	amount?: number;
	nutrient?: {
		id?: number;
		name?: string;
		number?: string;
		unitName?: string;
	};
};

type FdcFoodResponse = Omit<FdcFood, "foodNutrients"> & {
	foodNutrients?: Array<FdcNutrient | FdcDetailNutrient>;
};

const BASE_URL = "https://api.nal.usda.gov/fdc/v1";
export const FDC_CONFIGURATION_MESSAGE =
	"Food search needs a FoodData Central API key. Add VITE_FDC_API_KEY to your .env file.";

export class FdcConfigurationError extends Error {
	constructor() {
		super(FDC_CONFIGURATION_MESSAGE);
		this.name = "FdcConfigurationError";
	}
}

const getApiKey = (): string => {
	const key = import.meta.env.VITE_FDC_API_KEY ?? "";
	if (!key || key === "your_api_key_here") {
		throw new FdcConfigurationError();
	}
	return key;
};

const buildUrl = (path: string, params: Record<string, string> = {}): string => {
	const url = new URL(`${BASE_URL}${path}`);
	url.searchParams.set("api_key", getApiKey());
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}
	return url.toString();
};

const normalizeFoodNutrient = (
	nutrient: FdcNutrient | FdcDetailNutrient,
): FdcNutrient | null => {
	if ("nutrientId" in nutrient) {
		return {
			nutrientId: Number(nutrient.nutrientId),
			nutrientName: nutrient.nutrientName,
			nutrientNumber: String(nutrient.nutrientNumber ?? ""),
			unitName: nutrient.unitName,
			value: Number(nutrient.value) || 0,
		};
	}

	if (!nutrient.nutrient?.id) return null;
	return {
		nutrientId: nutrient.nutrient.id,
		nutrientName: nutrient.nutrient.name ?? "Unknown nutrient",
		nutrientNumber: String(nutrient.nutrient.number ?? ""),
		unitName: nutrient.nutrient.unitName ?? "",
		value: Number(nutrient.amount) || 0,
	};
};

export const normalizeFdcFood = (food: FdcFoodResponse): FdcFood => ({
	...food,
	foodNutrients: (food.foodNutrients ?? []).flatMap((nutrient) => {
		const normalized = normalizeFoodNutrient(nutrient);
		return normalized ? [normalized] : [];
	}),
});

export const searchFoods = async (query: string): Promise<FdcFood[]> => {
	const trimmed = query.trim();
	if (!trimmed) return [];

	const cacheKey = `search_${trimmed.toLowerCase()}_50`;
	const cached = cacheGet<FdcFood[]>(cacheKey);
	if (cached) return cached;

	const url = buildUrl("/foods/search", {
		query: trimmed,
		dataType: "Foundation,SR Legacy",
		pageSize: "50",
	});

	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`FDC search failed: ${res.status} ${res.statusText}`);
	}

	const data: FdcSearchResponse = await res.json();
	const foods = data.foods ?? [];

	cacheSet(cacheKey, foods);
	return foods;
};

export const getFoodById = async (fdcId: number): Promise<FdcFood> => {
	const cacheKey = `food_v2_${fdcId}`;
	const cached = cacheGet<FdcFood>(cacheKey);
	if (cached) return cached;

	const url = buildUrl(`/food/${fdcId}`);
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`FDC food fetch failed: ${res.status} ${res.statusText}`);
	}

	const food = normalizeFdcFood(await res.json());
	cacheSet(cacheKey, food);
	return food;
};

export const searchBrandedFoodByBarcode = async (
	barcode: string,
): Promise<FdcFood | null> => {
	const canonicalBarcode = normalizeBarcode(barcode);
	if (!canonicalBarcode) return null;

	const cacheKey = `barcode_fdc_v2_${canonicalBarcode}`;
	const cached = cacheGet<FdcFood | false>(cacheKey);
	if (cached !== null) return cached || null;

	for (const candidate of getBarcodeLookupCandidates(barcode)) {
		const url = buildUrl("/foods/search", {
			query: candidate,
			dataType: "Branded",
			pageSize: "25",
		});
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(
				`FDC barcode search failed: ${response.status} ${response.statusText}`,
			);
		}

		const data: FdcSearchResponse = await response.json();
		const match = (data.foods ?? []).find(
			(food) => food.gtinUpc && normalizeBarcode(food.gtinUpc) === canonicalBarcode,
		);
		if (match) {
			try {
				const detailedFood = await getFoodById(match.fdcId);
				cacheSet(cacheKey, detailedFood);
				return detailedFood;
			} catch {
				const normalizedMatch = normalizeFdcFood(match);
				cacheSet(cacheKey, normalizedMatch);
				return normalizedMatch;
			}
		}
	}

	cacheSet(cacheKey, false, 60 * 60 * 1000);
	return null;
};
