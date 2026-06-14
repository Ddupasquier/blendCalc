/**
 * FoodData Central (FDC) API client.
 * Docs: https://fdc.nal.usda.gov/api-guide.html
 *
 * Rate limit: 3,600 requests / hour with an API key.
 * All responses are cached in localStorage to minimise repeat calls.
 */

import { cacheGet, cacheSet } from "$lib/cache";
import type { FdcFood, FdcSearchResponse } from "$lib/utils/food/types";

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
	const cacheKey = `food_${fdcId}`;
	const cached = cacheGet<FdcFood>(cacheKey);
	if (cached) return cached;

	const url = buildUrl(`/food/${fdcId}`);
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`FDC food fetch failed: ${res.status} ${res.statusText}`);
	}

	const food: FdcFood = await res.json();
	cacheSet(cacheKey, food);
	return food;
};
