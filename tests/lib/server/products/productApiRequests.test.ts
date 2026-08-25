import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	recordProductSourceApiError,
	recordProductSourceApiRequest,
	recordProductSourceCacheHit,
} = vi.hoisted(() => ({
	recordProductSourceApiError: vi.fn(),
	recordProductSourceApiRequest: vi.fn(),
	recordProductSourceCacheHit: vi.fn(),
}));

vi.mock("$lib/server/products/sourceMetrics.server", () => ({
	recordProductSourceApiError,
	recordProductSourceApiRequest,
	recordProductSourceCacheHit,
}));

import {
	coalesceProductApiRequest,
	fetchCachedProductApiJson,
} from "$lib/server/products/productApiRequests.server";

describe("coalesceProductApiRequest", () => {
	beforeEach(() => {
		recordProductSourceApiError.mockClear();
		recordProductSourceApiRequest.mockClear();
		recordProductSourceCacheHit.mockClear();
	});

	it("shares one pending provider request across concurrent lookups", async () => {
		let resolveRequest: ((value: string) => void) | undefined;
		const request = vi.fn(
			() =>
				new Promise<string>((resolve) => {
					resolveRequest = resolve;
				}),
		);

		const first = coalesceProductApiRequest("provider:key", request);
		const second = coalesceProductApiRequest("provider:key", request);
		resolveRequest?.("result");

		await expect(Promise.all([first, second])).resolves.toEqual([
			"result",
			"result",
		]);
		expect(request).toHaveBeenCalledTimes(1);
		expect(recordProductSourceCacheHit).toHaveBeenCalledTimes(1);
	});

	it("removes a finished request so later lookups can refresh", async () => {
		const request = vi.fn().mockResolvedValue("result");

		await coalesceProductApiRequest("provider:key", request);
		await coalesceProductApiRequest("provider:key", request);

		expect(request).toHaveBeenCalledTimes(2);
	});

	it("removes a failed request so a later lookup can retry", async () => {
		const request = vi
			.fn()
			.mockRejectedValueOnce(new Error("temporary provider error"))
			.mockResolvedValueOnce("recovered");

		await expect(
			coalesceProductApiRequest("provider:retry", request),
		).rejects.toThrow("temporary provider error");
		await expect(
			coalesceProductApiRequest("provider:retry", request),
		).resolves.toBe("recovered");

		expect(request).toHaveBeenCalledTimes(2);
	});
});

describe("fetchCachedProductApiJson", () => {
	beforeEach(() => {
		recordProductSourceApiError.mockClear();
		recordProductSourceApiRequest.mockClear();
		recordProductSourceCacheHit.mockClear();
	});

	it("returns a fresh persistent cache entry without an external request", async () => {
		const cacheStore = {
			read: vi.fn().mockResolvedValue({
				response: { value: "cached" },
				statusCode: 200,
				expiresAt: new Date(Date.now() + 60_000).toISOString(),
				etag: null,
			}),
			write: vi.fn(),
		};
		const fetcher = vi.fn();

		await expect(
			fetchCachedProductApiJson({
				provider: "test-provider",
				requestKind: "barcode-product",
				cacheValue: "123",
				url: "https://example.com",
				ttlMilliseconds: 60_000,
				cacheStore,
				fetcher,
			}),
		).resolves.toEqual({ value: "cached" });

		expect(fetcher).not.toHaveBeenCalled();
		expect(recordProductSourceCacheHit).toHaveBeenCalledTimes(1);
	});

	it("writes successful provider responses to persistent cache", async () => {
		const cacheStore = {
			read: vi.fn().mockResolvedValue(null),
			write: vi.fn().mockResolvedValue(undefined),
		};
		const fetcher = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ value: "fresh" }), {
				status: 200,
				headers: { etag: "response-v1" },
			}),
		);

		await expect(
			fetchCachedProductApiJson({
				provider: "test-provider",
				requestKind: "barcode-product",
				cacheValue: "456",
				url: "https://example.com",
				ttlMilliseconds: 60_000,
				cacheStore,
				fetcher,
			}),
		).resolves.toEqual({ value: "fresh" });

		expect(cacheStore.write).toHaveBeenCalledWith(
			expect.objectContaining({
				provider: "test-provider",
				requestKind: "barcode-product",
				statusCode: 200,
				response: { value: "fresh" },
				etag: "response-v1",
			}),
		);
	});

	it("uses a recently expired cache entry when the provider is unavailable", async () => {
		const cacheStore = {
			read: vi.fn().mockResolvedValue({
				response: { value: "stale" },
				statusCode: 200,
				expiresAt: new Date(Date.now() - 1_000).toISOString(),
				etag: null,
			}),
			write: vi.fn(),
		};
		const fetcher = vi.fn().mockRejectedValue(new Error("provider offline"));

		await expect(
			fetchCachedProductApiJson({
				provider: "test-provider",
				requestKind: "barcode-product",
				cacheValue: "789",
				url: "https://example.com",
				ttlMilliseconds: 60_000,
				staleIfErrorMilliseconds: 60_000,
				cacheStore,
				fetcher,
				sleep: vi.fn().mockResolvedValue(undefined),
			}),
		).resolves.toEqual({ value: "stale" });

		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(recordProductSourceCacheHit).toHaveBeenCalledTimes(1);
	});

	it("caches an accepted not-found response without writing a database null", async () => {
		const cacheStore = {
			read: vi.fn().mockResolvedValue(null),
			write: vi.fn().mockResolvedValue(undefined),
		};
		const fetcher = vi
			.fn()
			.mockResolvedValue(new Response(null, { status: 404 }));

		await expect(
			fetchCachedProductApiJson<null>({
				provider: "test-provider",
				requestKind: "barcode-product",
				cacheValue: "missing",
				url: "https://example.com",
				ttlMilliseconds: 60_000,
				notFoundStatusCodes: [404],
				notFoundValue: null,
				cacheStore,
				fetcher,
			}),
		).resolves.toBeNull();

		expect(cacheStore.write).toHaveBeenCalledWith(
			expect.objectContaining({
				statusCode: 404,
				response: { cacheOutcome: "product-not-found" },
			}),
		);
	});

	it("restores the caller's not-found value from a fresh negative cache entry", async () => {
		const cacheStore = {
			read: vi.fn().mockResolvedValue({
				response: { cacheOutcome: "product-not-found" },
				statusCode: 404,
				expiresAt: new Date(Date.now() + 60_000).toISOString(),
				etag: null,
			}),
			write: vi.fn(),
		};
		const fetcher = vi.fn();

		await expect(
			fetchCachedProductApiJson<null>({
				provider: "test-provider",
				requestKind: "barcode-product",
				cacheValue: "missing-from-cache",
				url: "https://example.com",
				ttlMilliseconds: 60_000,
				notFoundStatusCodes: [404],
				notFoundValue: null,
				cacheStore,
				fetcher,
			}),
		).resolves.toBeNull();

		expect(fetcher).not.toHaveBeenCalled();
		expect(cacheStore.write).not.toHaveBeenCalled();
		expect(recordProductSourceCacheHit).toHaveBeenCalledTimes(1);
	});
});
