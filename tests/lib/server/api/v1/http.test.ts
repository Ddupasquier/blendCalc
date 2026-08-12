import { describe, expect, it } from "vitest";
import { API_V1_ERROR_DEFINITIONS } from "$lib/api/v1/errors";
import {
	apiV1Error,
	normalizeApiV1BoundaryResponse,
} from "$lib/server/api/v1/http.server";

describe("blendCalc API v1 error responses", () => {
	it.each(Object.entries(API_V1_ERROR_DEFINITIONS))(
		"returns the stable %s response",
		async (code, definition) => {
			const response = apiV1Error(code as keyof typeof API_V1_ERROR_DEFINITIONS);
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
	])("normalizes an unversioned HTTP %i boundary response", async (status, code) => {
		const response = normalizeApiV1BoundaryResponse(
			"/api/v1/categories",
			new Response("private server detail", { status }),
		);
		expect(response.status).toBe(status);
		const payload = await response.json();
		expect(payload.error.code).toBe(code);
		expect(JSON.stringify(payload)).not.toContain("private server detail");
	});

	it("preserves safe rate-limit response headers", () => {
		const response = normalizeApiV1BoundaryResponse(
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
		expect(normalizeApiV1BoundaryResponse("/profile", pageResponse)).toBe(
			pageResponse,
		);

		const versionedResponse = apiV1Error("catalog_unavailable");
		expect(
			normalizeApiV1BoundaryResponse("/api/v1/categories", versionedResponse),
		).toBe(versionedResponse);
	});
});
