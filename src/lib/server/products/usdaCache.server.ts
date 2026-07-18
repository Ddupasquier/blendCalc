import { createHash } from "node:crypto";
import { env } from "$env/dynamic/private";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { normalizeFdcFood } from "$lib/utils/food/sources/fdc";
import type { FdcFood, FdcSearchResponse } from "$lib/utils/food/types";
import { toJson } from "$lib/utils/storage/supabase/shared";
import {
	buildUsdaExactSearchQuery,
	buildUsdaPartialSearchQuery,
} from "$lib/server/products/usdaSearchQuery";
import { getProductReferenceData } from "$lib/server/products/productReferenceData.server";
import { getProductDataSource } from "$lib/utils/food/reference/productReferenceData";
import { rankUsdaGenericFoods } from "$lib/server/products/usdaFoodSelection";
import {
	createProductSourceRequestTrace,
	recordProductSourceApiError,
	recordProductSourceApiRequest,
	recordProductSourceCacheHit,
	recordProductSourceLookup,
	type ProductSourceRequestTrace,
} from "$lib/server/products/sourceMetrics.server";
import { summarizeUsdaFoodQuality } from "$lib/utils/food/sources/sourceQuality";

const FDC_BASE_URL = "https://api.nal.usda.gov/fdc/v1";
const SEARCH_CACHE_MILLISECONDS = 12 * 60 * 60 * 1000;
const BARCODE_CACHE_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;
const DETAIL_CACHE_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;
const SEARCH_RESULT_LIMIT = 100;
const PARTIAL_SEARCH_CANDIDATE_LIMIT = 100;
const GENERIC_USDA_DATA_TYPES = "Foundation,SR Legacy,Survey (FNDDS)";

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
	trace?: ProductSourceRequestTrace;
}): Promise<T> => {
	const cacheKey = getCacheKey(input.requestKind, input.cacheValue);
	const cached = await getCachedResponse<T>(cacheKey);
	if (cached) {
		recordProductSourceCacheHit(input.trace);
		return cached;
	}

	recordProductSourceApiRequest(input.trace);
	let response: Response;
	try {
		response = await fetch(buildFdcUrl(input.path, input.params), {
			headers: { accept: "application/json" },
		});
	} catch (error) {
		recordProductSourceApiError(input.trace);
		throw error;
	}
	if (!response.ok) {
		recordProductSourceApiError(input.trace);
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

const searchUsdaFoodsWithTrace = async (
	query: string,
	trace: ProductSourceRequestTrace,
): Promise<FdcFood[]> => {
	const normalizedQuery = query.trim().replace(/\s+/g, " ");
	if (!normalizedQuery) return [];
	const exactQuery = buildUsdaExactSearchQuery(normalizedQuery);
	const partialQuery = buildUsdaPartialSearchQuery(normalizedQuery);
	if (!exactQuery || !partialQuery) return [];
	const usdaSource = getProductDataSource(
		await getProductReferenceData(),
		"usda",
	);
	const addProvenance = (foods: FdcFood[]) => foods.map((food) => ({
		...food,
		sourceKey: usdaSource.key,
		sourceLabel: usdaSource.displayName,
		sourceDataType: food.dataType,
		sourcePublishedDate: food.publishedDate ?? food.publicationDate,
		sourceModifiedDate: food.modifiedDate,
	}));

	const exactData = await fetchUsdaJson<FdcSearchResponse>({
		path: "/foods/search",
		params: {
			query: exactQuery,
			dataType: GENERIC_USDA_DATA_TYPES,
			pageSize: String(SEARCH_RESULT_LIMIT),
		},
		requestKind: "search",
		cacheValue: {
			query: exactQuery,
			dataType: GENERIC_USDA_DATA_TYPES,
			pageSize: SEARCH_RESULT_LIMIT,
		},
		ttlMilliseconds: SEARCH_CACHE_MILLISECONDS,
		trace,
	});
	const exactFoods = addProvenance(
		(exactData.foods ?? []).map(normalizeFdcFood),
	);
	if (exactFoods.length > 0) {
		return rankUsdaGenericFoods(exactFoods, normalizedQuery)
			.slice(0, SEARCH_RESULT_LIMIT);
	}

	const partialData = await fetchUsdaJson<FdcSearchResponse>({
		path: "/foods/search",
		params: {
			query: partialQuery,
			dataType: GENERIC_USDA_DATA_TYPES,
			pageSize: String(PARTIAL_SEARCH_CANDIDATE_LIMIT),
		},
		requestKind: "search",
		cacheValue: {
			query: partialQuery,
			dataType: GENERIC_USDA_DATA_TYPES,
			pageSize: PARTIAL_SEARCH_CANDIDATE_LIMIT,
		},
		ttlMilliseconds: SEARCH_CACHE_MILLISECONDS,
		trace,
	});
	return rankUsdaGenericFoods(
		addProvenance((partialData.foods ?? []).map(normalizeFdcFood)),
		normalizedQuery,
	).slice(0, SEARCH_RESULT_LIMIT);
};

export const searchUsdaFoods = async (query: string): Promise<FdcFood[]> => {
	const normalizedQuery = query.trim().replace(/\s+/g, " ");
	if (!normalizedQuery) return [];

	const startedAt = Date.now();
	const trace = createProductSourceRequestTrace();
	try {
		const foods = await searchUsdaFoodsWithTrace(normalizedQuery, trace);
		const topFood = foods[0];
		await recordProductSourceLookup({
			sourceKey: "usda",
			sourceDataType: topFood?.sourceDataType ?? topFood?.dataType ?? "Generic",
			lookupKind: "generic-search",
			outcome: topFood ? "matched" : "not-found",
			startedAt,
			trace,
			quality: topFood ? summarizeUsdaFoodQuality(topFood) : undefined,
		});
		return foods;
	} catch (error) {
		await recordProductSourceLookup({
			sourceKey: "usda",
			sourceDataType: "Generic",
			lookupKind: "generic-search",
			outcome: "error",
			startedAt,
			trace,
		});
		throw error;
	}
};

export const searchUsdaBrandedFoods = async (
	query: string,
	trace?: ProductSourceRequestTrace,
) =>
	fetchUsdaJson<FdcSearchResponse>({
		path: "/foods/search",
		params: { query, dataType: "Branded", pageSize: "50" },
		requestKind: "barcode-search",
		cacheValue: { query, dataType: "Branded", pageSize: 50 },
		ttlMilliseconds: BARCODE_CACHE_MILLISECONDS,
		trace,
	});

export const getUsdaFoodById = async (
	fdcId: number,
	trace?: ProductSourceRequestTrace,
): Promise<FdcFood> => {
	const food = await fetchUsdaJson<FdcFood>({
		path: `/food/${fdcId}`,
		requestKind: "food-detail",
		cacheValue: { fdcId },
		ttlMilliseconds: DETAIL_CACHE_MILLISECONDS,
		trace,
	});
	const normalizedFood = normalizeFdcFood(food);
	const source = getProductDataSource(await getProductReferenceData(), "usda");
	return {
		...normalizedFood,
		sourceKey: source.key,
		sourceLabel: source.displayName,
		sourceDataType: normalizedFood.dataType,
		sourcePublishedDate:
			normalizedFood.publishedDate ?? normalizedFood.publicationDate,
		sourceModifiedDate: normalizedFood.modifiedDate,
	};
};
