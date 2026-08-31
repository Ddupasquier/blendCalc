import { describe, expect, it } from "vitest";
import { BLENDCALC_API_V1_ERROR_DEFINITIONS } from "$lib/blendCalcAPI/v1/blendCalcAPIErrors";
import {
	blendCalcAPIV1Error,
	blendCalcAPIV1Success,
	normalizeBlendCalcAPIV1BoundaryResponse,
} from "$lib/server/blendCalcAPI/v1/blendCalcAPIHttp.server";

describe("blendCalcAPI v1 success responses", () => {
	it("returns a stable private ETag and honors conditional reads", async () => {
		const first = blendCalcAPIV1Success({ id: "product-1" });
		const etag = first.headers.get("etag");
		expect(etag).toMatch(/^"[A-Za-z0-9_-]+"$/);
		expect(first.headers.get("cache-control")).toBe(
			"private, max-age=60, stale-while-revalidate=300",
		);
		expect(first.headers.get("vary")).toContain("authorization");

		const conditional = blendCalcAPIV1Success({ id: "product-1" }, undefined, {
			ifNoneMatch: etag,
		});
		expect(conditional.status).toBe(304);
		expect(conditional.headers.get("etag")).toBe(etag);
	});

	it("supports shared caching only when a caller explicitly marks data public", () => {
		const response = blendCalcAPIV1Success(
			{ id: "public-product" },
			undefined,
			{ cacheVisibility: "public" },
		);
		expect(response.headers.get("cache-control")).toBe(
			"public, max-age=60, s-maxage=300, stale-while-revalidate=300",
		);
		expect(response.headers.get("vary")).not.toContain("authorization");
	});

	it("keeps ETags stable when PostgreSQL JSONB returns object keys in another order", () => {
		const source = blendCalcAPIV1Success({
			name: "Product",
			category: { id: "sauces", name: "Sauces" },
		});
		const isolated = blendCalcAPIV1Success({
			category: { name: "Sauces", id: "sauces" },
			name: "Product",
		});
		expect(isolated.headers.get("etag")).toBe(source.headers.get("etag"));
	});
});

describe("blendCalcAPI v1 error responses", () => {
	it.each(Object.entries(BLENDCALC_API_V1_ERROR_DEFINITIONS))(
		"returns the stable %s response",
		async (code, definition) => {
			const response = blendCalcAPIV1Error(
				code as keyof typeof BLENDCALC_API_V1_ERROR_DEFINITIONS,
			);
			expect(response.status).toBe(definition.status);
			expect(response.headers.get("cache-control")).toBe("private, no-store");
			expect(response.headers.get("x-blendcalc-api-version")).toBe("1.0");
			await expect(response.json()).resolves.toEqual({
				apiVersion: "1.0",
				error: { code, message: definition.message },
			});
		},
	);

	it.each([
		[400, "invalid_request"],
		[401, "authentication_required"],
		[403, "access_denied"],
		[404, "resource_not_found"],
		[405, "method_not_allowed"],
		[429, "rate_limited"],
		[500, "unexpected_error"],
		[503, "service_unavailable"],
	])(
		"normalizes an unversioned HTTP %i boundary response",
		async (status, code) => {
			const response = normalizeBlendCalcAPIV1BoundaryResponse(
				"/api/v1/categories",
				new Response("private server detail", { status }),
			);
			expect(response.status).toBe(status);
			const payload = await response.json();
			expect(payload.error.code).toBe(code);
			expect(JSON.stringify(payload)).not.toContain("private server detail");
		},
	);

	it("preserves safe rate-limit response headers", () => {
		const response = normalizeBlendCalcAPIV1BoundaryResponse(
			"/api/v1/categories",
			new Response(null, {
				status: 429,
				headers: {
					"retry-after": "12",
					"x-ratelimit-remaining": "0",
					"x-private-debug": "must-not-leak",
				},
			}),
		);
		expect(response.headers.get("retry-after")).toBe("12");
		expect(response.headers.get("x-ratelimit-remaining")).toBe("0");
		expect(response.headers.has("x-private-debug")).toBe(false);
	});

	it("does not rewrite non-API or already-versioned responses", () => {
		const pageResponse = new Response("page", { status: 500 });
		expect(
			normalizeBlendCalcAPIV1BoundaryResponse("/profile", pageResponse),
		).toBe(pageResponse);

		const versionedResponse = blendCalcAPIV1Error("catalog_unavailable");
		expect(
			normalizeBlendCalcAPIV1BoundaryResponse(
				"/api/v1/categories",
				versionedResponse,
			),
		).toBe(versionedResponse);
	});
});
