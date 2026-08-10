import { describe, expect, it, vi } from "vitest";
import { fetchWithExternalRequestPolicy } from "$lib/server/http/externalRequest.server";

describe("fetchWithExternalRequestPolicy", () => {
	it("retries a short-lived GET failure once", async () => {
		const fetcher = vi.fn()
			.mockResolvedValueOnce(new Response(null, { status: 503 }))
			.mockResolvedValueOnce(new Response("ok", { status: 200 }));
		const sleep = vi.fn().mockResolvedValue(undefined);

		const response = await fetchWithExternalRequestPolicy("https://example.com", {
			fetcher,
			sleep,
		});

		expect(response.status).toBe(200);
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(sleep).toHaveBeenCalledTimes(1);
	});

	it("does not retry sooner than a long Retry-After response permits", async () => {
		const fetcher = vi.fn().mockResolvedValue(
			new Response(null, {
				status: 429,
				headers: { "retry-after": "60" },
			}),
		);

		const response = await fetchWithExternalRequestPolicy("https://example.com", {
			fetcher,
		});

		expect(response.status).toBe(429);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it("only retries POST requests that have an idempotency key", async () => {
		const withoutKey = vi.fn().mockResolvedValue(
			new Response(null, { status: 503 }),
		);
		await fetchWithExternalRequestPolicy("https://example.com", {
			method: "POST",
			fetcher: withoutKey,
		});

		const withKey = vi.fn()
			.mockResolvedValueOnce(new Response(null, { status: 503 }))
			.mockResolvedValueOnce(new Response("ok", { status: 200 }));
		await fetchWithExternalRequestPolicy("https://example.com", {
			method: "POST",
			headers: { "Idempotency-Key": "request-1" },
			fetcher: withKey,
			sleep: vi.fn().mockResolvedValue(undefined),
		});

		expect(withoutKey).toHaveBeenCalledTimes(1);
		expect(withKey).toHaveBeenCalledTimes(2);
	});

	it("aborts a request that exceeds its deadline", async () => {
		const fetcher = vi.fn((_: RequestInfo | URL, init?: RequestInit) =>
			new Promise<Response>((_, reject) => {
				init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
			})
		);

		await expect(
			fetchWithExternalRequestPolicy("https://example.com", {
				fetcher,
				timeoutMilliseconds: 5,
				maxAttempts: 1,
			}),
		).rejects.toThrow("External request timed out.");
	});
});
