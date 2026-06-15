import { createHash } from "node:crypto";
import { env } from "$env/dynamic/private";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { normalizeFdcFood } from "$lib/utils/food/fdc";
import type { FdcFood, FdcSearchResponse } from "$lib/utils/food/types";
import { toJson } from "$lib/utils/storage/supabase/shared";

const FDC_BASE_URL = "https://api.nal.usda.gov/fdc/v1";
const SEARCH_CACHE_MILLISECONDS = 12 * 60 * 60 * 1000;
const BARCODE_CACHE_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;
const DETAIL_CACHE_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;

type CacheRequestKind = "search" | "barcode-search" | "food-detail";

const getFdcApiKey = () =>
	env.FDC_API_KEY?.trim() || env.VITE_FDC_API_KEY?.trim() || null;

const getCacheKey = (kind: CacheRequestKind, value: unknown) =>
	createHash("sha256")
		.update(JSON.stringify({ kind, value }))
		.digest("hex");

const buildFdcUrl = (path: string, params: Record<string, string> = {}) => {
	const apiKey = getFdcApiKey();
	if (!apiKey) {
		throw new Error("FoodData Central is not configured on the server.");
	}

	const url = new URL(`${FDC_BASE_URL}${path}`);
	url.searchParams.set("api_key", apiKey);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}
	return url;
};

const getCachedResponse = async <T>(cacheKey: string): Promise<T | null> => {
	const admin = getSupabaseAdminClient();
	const { data, error } = await admin
		.from("product_api_cache")
		.select("response, expires_at")
		.eq("provider", "usda")
		.eq("cache_key", cacheKey)
		.gt("expires_at", new Date().toISOString())
		.maybeSingle();
	if (error) throw error;
	return data?.response as T | null;
};

const cacheResponse = async (
	cacheKey: string,
	requestKind: CacheRequestKind,
	statusCode: number,
	response: unknown,
	ttlMilliseconds: number,
) => {
	const admin = getSupabaseAdminClient();
	const fetchedAt = new Date();
	const { error } = await admin.from("product_api_cache").upsert({
		provider: "usda",
		cache_key: cacheKey,
		request_kind: requestKind,
		status_code: statusCode,
		response: toJson(response),
		fetched_at: fetchedAt.toISOString(),
		expires_at: new Date(fetchedAt.getTime() + ttlMilliseconds).toISOString(),
	});
	if (error) throw error;
};

const fetchUsdaJson = async <T>(input: {
	path: string;
	params?: Record<string, string>;
	requestKind: CacheRequestKind;
	cacheValue: unknown;
	ttlMilliseconds: number;
}): Promise<T> => {
	const cacheKey = getCacheKey(input.requestKind, input.cacheValue);
	const cached = await getCachedResponse<T>(cacheKey);
	if (cached) return cached;

	const response = await fetch(buildFdcUrl(input.path, input.params), {
		headers: { accept: "application/json" },
	});
	if (!response.ok) {
		throw new Error(`USDA request failed with ${response.status}.`);
	}
	const payload = await response.json() as T;
	await cacheResponse(
		cacheKey,
		input.requestKind,
		response.status,
		payload,
		input.ttlMilliseconds,
	);
	return payload;
};

export const searchUsdaFoods = async (query: string): Promise<FdcFood[]> => {
	const normalizedQuery = query.trim().replace(/\s+/g, " ");
	if (!normalizedQuery) return [];

	const data = await fetchUsdaJson<FdcSearchResponse>({
		path: "/foods/search",
		params: {
			query: normalizedQuery,
			dataType: "Foundation,SR Legacy",
			pageSize: "50",
		},
		requestKind: "search",
		cacheValue: { query: normalizedQuery.toLocaleLowerCase(), pageSize: 50 },
		ttlMilliseconds: SEARCH_CACHE_MILLISECONDS,
	});
	return (data.foods ?? []).map(normalizeFdcFood);
};

export const searchUsdaBrandedFoods = async (query: string) =>
	fetchUsdaJson<FdcSearchResponse>({
		path: "/foods/search",
		params: { query, dataType: "Branded", pageSize: "25" },
		requestKind: "barcode-search",
		cacheValue: { query, pageSize: 25 },
		ttlMilliseconds: BARCODE_CACHE_MILLISECONDS,
	});

export const getUsdaFoodById = async (fdcId: number): Promise<FdcFood> => {
	const food = await fetchUsdaJson<FdcFood>({
		path: `/food/${fdcId}`,
		requestKind: "food-detail",
		cacheValue: { fdcId },
		ttlMilliseconds: DETAIL_CACHE_MILLISECONDS,
	});
	return normalizeFdcFood(food);
};
