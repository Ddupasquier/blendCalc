import { describe, expect, it, vi } from "vitest";
import { fetchWithExternalRequestPolicy } from "$lib/server/http/externalRequest.server";

describe("fetchWithExternalRequestPolicy", () => {
	it("retries a short-lived GET failure once", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 503 }))
			.mockResolvedValueOnce(new Response("ok", { status: 200 }));
		const sleep = vi.fn().mockResolvedValue(undefined);

		const response = await fetchWithExternalRequestPolicy(
			"https://example.com",
			{
				fetcher,
				runtimeEnvironment: "production",
				sleep,
			},
		);

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

		const response = await fetchWithExternalRequestPolicy(
			"https://example.com",
			{
				fetcher,
				runtimeEnvironment: "production",
			},
		);

		expect(response.status).toBe(429);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it("honors a provider-specific single-attempt policy for rate limits", async () => {
		const fetcher = vi.fn().mockResolvedValue(
			new Response(null, {
				status: 429,
				headers: { "retry-after": "1" },
			}),
		);
		const sleep = vi.fn();

		const response = await fetchWithExternalRequestPolicy(
			"https://example.com",
			{
				fetcher,
				sleep,
				maxAttempts: 1,
				runtimeEnvironment: "production",
			},
		);

		expect(response.status).toBe(429);
		expect(fetcher).toHaveBeenCalledOnce();
		expect(sleep).not.toHaveBeenCalled();
	});

	it("only retries POST requests that have an idempotency key", async () => {
		const withoutKey = vi
			.fn()
			.mockResolvedValue(new Response(null, { status: 503 }));
		await fetchWithExternalRequestPolicy("https://example.com", {
			method: "POST",
			fetcher: withoutKey,
			runtimeEnvironment: "production",
		});

		const withKey = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 503 }))
			.mockResolvedValueOnce(new Response("ok", { status: 200 }));
		await fetchWithExternalRequestPolicy("https://example.com", {
			method: "POST",
			headers: { "Idempotency-Key": "request-1" },
			fetcher: withKey,
			runtimeEnvironment: "production",
			sleep: vi.fn().mockResolvedValue(undefined),
		});

		expect(withoutKey).toHaveBeenCalledTimes(1);
		expect(withKey).toHaveBeenCalledTimes(2);
	});

	it("aborts a request that exceeds its deadline", async () => {
		const fetcher = vi.fn(
			(_: RequestInfo | URL, init?: RequestInit) =>
				new Promise<Response>((_, reject) => {
					init?.signal?.addEventListener("abort", () =>
						reject(init.signal?.reason),
					);
				}),
		);

		await expect(
			fetchWithExternalRequestPolicy("https://example.com", {
				fetcher,
				timeoutMilliseconds: 5,
				maxAttempts: 1,
				runtimeEnvironment: "production",
			}),
		).rejects.toThrow("External request timed out.");
	});

	it.each(["local", "test", "rehearsal"] as const)(
		"rejects non-loopback requests in the %s runtime before calling fetch",
		async (runtimeEnvironment) => {
			const fetcher = vi.fn();
			await expect(
				fetchWithExternalRequestPolicy("https://example.com", {
					fetcher,
					runtimeEnvironment,
				}),
			).rejects.toThrow(
				`External network requests are disabled in the ${runtimeEnvironment} runtime.`,
			);
			expect(fetcher).not.toHaveBeenCalled();
		},
	);

	it("allows loopback requests in a safe local runtime", async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response("ok"));
		await expect(
			fetchWithExternalRequestPolicy("http://127.0.0.1:54321/rest/v1", {
				fetcher,
				runtimeEnvironment: "test",
			}),
		).resolves.toHaveProperty("status", 200);
	});

	it("allows only read-only requests to the trusted product-image host", async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response("image"));
		await expect(
			fetchWithExternalRequestPolicy(
				"https://images.openfoodfacts.org/example.jpg",
				{ fetcher, runtimeEnvironment: "test" },
			),
		).resolves.toHaveProperty("status", 200);
		await expect(
			fetchWithExternalRequestPolicy(
				"https://images.openfoodfacts.org/example.jpg",
				{ fetcher, method: "POST", runtimeEnvironment: "test" },
			),
		).rejects.toThrow("External network requests are disabled");
	});
});
