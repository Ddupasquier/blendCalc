import { createHash } from "node:crypto";
import { fetchWithExternalRequestPolicy } from "$lib/server/http/externalRequest.server";
import { completeServerBackgroundTask } from "$lib/server/runtime/backgroundTask.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { toJson } from "$lib/utils/storage/supabase/shared";
import {
	recordProductSourceApiError,
	recordProductSourceApiRequest,
	recordProductSourceCacheHit,
	type ProductSourceRequestTrace,
} from "$lib/server/products/sourceMetrics.server";

const inFlightRequests = new Map<string, Promise<unknown>>();
const memoryCache = new Map<string, ProductApiCacheRecord<unknown>>();
const MEMORY_CACHE_MAX_ENTRIES = 250;

type ProductApiCacheRecord<T> = {
	response: T;
	statusCode: number;
	expiresAt: string;
	etag: string | null;
};

type ProductApiCacheStore = {
	read: (
		provider: string,
		cacheKey: string,
	) => Promise<ProductApiCacheRecord<unknown> | null>;
	write: (input: {
		provider: string;
		cacheKey: string;
		requestKind: string;
		statusCode: number;
		response: unknown;
		fetchedAt: string;
		expiresAt: string;
		etag: string | null;
	}) => Promise<void>;
};

type CachedProductApiRequest<T> = {
	provider: string;
	requestKind: string;
	cacheValue: unknown;
	url: string | URL;
	headers?: HeadersInit;
	ttlMilliseconds: number;
	notFoundTtlMilliseconds?: number;
	staleIfErrorMilliseconds?: number;
	timeoutMilliseconds?: number;
	notFoundStatusCodes?: number[];
	notFoundValue?: T;
	trace?: ProductSourceRequestTrace;
	cacheStore?: ProductApiCacheStore;
	fetcher?: typeof fetch;
	sleep?: (milliseconds: number) => Promise<void>;
};

const getCacheKey = (requestKind: string, cacheValue: unknown) =>
	createHash("sha256")
		.update(JSON.stringify({ kind: requestKind, value: cacheValue }))
		.digest("hex");

const getMemoryCacheKey = (provider: string, cacheKey: string) =>
	`${provider}:${cacheKey}`;

const readMemoryCache = (provider: string, cacheKey: string) => {
	const memoryKey = getMemoryCacheKey(provider, cacheKey);
	const cached = memoryCache.get(memoryKey);
	if (!cached) return null;
	memoryCache.delete(memoryKey);
	memoryCache.set(memoryKey, cached);
	return cached;
};

const writeMemoryCache = (
	provider: string,
	cacheKey: string,
	record: ProductApiCacheRecord<unknown>,
) => {
	const memoryKey = getMemoryCacheKey(provider, cacheKey);
	memoryCache.delete(memoryKey);
	memoryCache.set(memoryKey, record);
	while (memoryCache.size > MEMORY_CACHE_MAX_ENTRIES) {
		const oldestKey = memoryCache.keys().next().value;
		if (!oldestKey) break;
		memoryCache.delete(oldestKey);
	}
};

const supabaseProductApiCacheStore: ProductApiCacheStore = {
	read: async (provider, cacheKey) => {
		const memoryRecord = readMemoryCache(provider, cacheKey);
		if (memoryRecord) return memoryRecord;
		const { data, error } = await getSupabaseAdminClient()
			.from("product_api_cache")
			.select("response, status_code, expires_at, etag")
			.eq("provider", provider)
			.eq("cache_key", cacheKey)
			.maybeSingle();
		if (error) throw error;
		if (!data) return null;
		const record = {
			response: data.response,
			statusCode: data.status_code,
			expiresAt: data.expires_at,
			etag: data.etag,
		};
		writeMemoryCache(provider, cacheKey, record);
		return record;
	},
	write: async (input) => {
		writeMemoryCache(input.provider, input.cacheKey, {
			response: input.response,
			statusCode: input.statusCode,
			expiresAt: input.expiresAt,
			etag: input.etag,
		});
		const { error } = await getSupabaseAdminClient()
			.from("product_api_cache")
			.upsert({
				provider: input.provider,
				cache_key: input.cacheKey,
				request_kind: input.requestKind,
				status_code: input.statusCode,
				response: toJson(input.response),
				fetched_at: input.fetchedAt,
				expires_at: input.expiresAt,
				etag: input.etag,
			});
		if (error) throw error;
	},
};

const warnAboutCacheFailure = (provider: string, operation: string, error: unknown) => {
	console.warn(
		`Unable to ${operation} ${provider} API cache:`,
		error instanceof Error ? error.message : error,
	);
};

const readCacheSafely = async <T>(
	store: ProductApiCacheStore,
	provider: string,
	cacheKey: string,
) => {
	try {
		return await store.read(provider, cacheKey) as ProductApiCacheRecord<T> | null;
	} catch (error) {
		warnAboutCacheFailure(provider, "read", error);
		return null;
	}
};

const writeCacheSafely = async (
	store: ProductApiCacheStore,
	input: Parameters<ProductApiCacheStore["write"]>[0],
) => {
	try {
		await store.write(input);
	} catch (error) {
		warnAboutCacheFailure(input.provider, "write", error);
	}
};

export const coalesceProductApiRequest = async <T>(
	requestKey: string,
	request: () => Promise<T>,
	trace?: ProductSourceRequestTrace,
): Promise<T> => {
	const existingRequest = inFlightRequests.get(requestKey) as Promise<T> | undefined;
	if (existingRequest) {
		recordProductSourceCacheHit(trace);
		return existingRequest;
	}

	const pendingRequest = request();
	inFlightRequests.set(requestKey, pendingRequest);

	try {
		return await pendingRequest;
	} finally {
		if (inFlightRequests.get(requestKey) === pendingRequest) {
			inFlightRequests.delete(requestKey);
		}
	}
};

export const fetchCachedProductApiJson = async <T>(
	input: CachedProductApiRequest<T>,
): Promise<T> => {
	const cacheKey = getCacheKey(input.requestKind, input.cacheValue);
	const requestKey = `${input.provider}:${cacheKey}`;
	const cacheStore = input.cacheStore ?? supabaseProductApiCacheStore;
	const notFoundStatuses = new Set(input.notFoundStatusCodes ?? []);

	return coalesceProductApiRequest(requestKey, async () => {
		const now = Date.now();
		const cached = await readCacheSafely<T>(
			cacheStore,
			input.provider,
			cacheKey,
		);
		const expiresAt = cached ? Date.parse(cached.expiresAt) : 0;
		if (cached && expiresAt > now) {
			recordProductSourceCacheHit(input.trace);
			return cached.response;
		}

		const headers = new Headers(input.headers);
		if (cached?.etag) headers.set("if-none-match", cached.etag);

		try {
			const response = await fetchWithExternalRequestPolicy(input.url, {
				headers,
				timeoutMilliseconds: input.timeoutMilliseconds,
				acceptedStatusCodes: [
					...notFoundStatuses,
					...(cached ? [304] : []),
				],
				onAttempt: () => recordProductSourceApiRequest(input.trace),
				onAttemptFailure: () => recordProductSourceApiError(input.trace),
				fetcher: input.fetcher,
				sleep: input.sleep,
			});

			if (response.status === 304 && cached) {
				const fetchedAt = new Date();
				await completeServerBackgroundTask(writeCacheSafely(cacheStore, {
					provider: input.provider,
					cacheKey,
					requestKind: input.requestKind,
					statusCode: cached.statusCode,
					response: cached.response,
					fetchedAt: fetchedAt.toISOString(),
					expiresAt: new Date(
						fetchedAt.getTime() + input.ttlMilliseconds,
					).toISOString(),
					etag: cached.etag,
				}));
				recordProductSourceCacheHit(input.trace);
				return cached.response;
			}

			if (!response.ok && !notFoundStatuses.has(response.status)) {
				throw new Error(
					`${input.provider} request failed with ${response.status}.`,
				);
			}

			let payload: T;
			if (notFoundStatuses.has(response.status)) {
				payload = input.notFoundValue as T;
			} else {
				try {
					payload = await response.json() as T;
				} catch (error) {
					recordProductSourceApiError(input.trace);
					throw error;
				}
			}

			const fetchedAt = new Date();
			const ttlMilliseconds = notFoundStatuses.has(response.status)
				? input.notFoundTtlMilliseconds ?? input.ttlMilliseconds
				: input.ttlMilliseconds;
			await completeServerBackgroundTask(writeCacheSafely(cacheStore, {
				provider: input.provider,
				cacheKey,
				requestKind: input.requestKind,
				statusCode: response.status,
				response: payload,
				fetchedAt: fetchedAt.toISOString(),
				expiresAt: new Date(
					fetchedAt.getTime() + ttlMilliseconds,
				).toISOString(),
				etag: response.headers.get("etag"),
			}));
			return payload;
		} catch (error) {
			const staleUntil = expiresAt + (input.staleIfErrorMilliseconds ?? 0);
			if (cached && staleUntil > Date.now()) {
				recordProductSourceCacheHit(input.trace);
				return cached.response;
			}
			throw error;
		}
	}, input.trace);
};
