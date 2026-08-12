import { getRequestRateLimitPolicy } from "$lib/server/security/requestRateLimit.server";
import { describe, expect, it } from "vitest";

describe("request rate-limit policies", () => {
	it("uses strict quotas for catalog submissions and compatibility feedback", () => {
		expect(
			getRequestRateLimitPolicy("POST", "/api/products/submissions"),
		).toMatchObject({
			scope: "catalog:submission",
			limit: 10,
			windowSeconds: 3600,
		});
		expect(
			getRequestRateLimitPolicy(
				"POST",
				"/api/food-compatibility/feedback",
			),
		).toMatchObject({
			scope: "compatibility:feedback",
			limit: 30,
			windowSeconds: 3600,
		});
	});

	it("allows normal search traffic without leaving it unbounded", () => {
		expect(getRequestRateLimitPolicy("GET", "/api/foods/search")).toMatchObject({
			scope: "food:search",
			limit: 180,
			windowSeconds: 60,
		});
	});

	it("limits signed-out publication concerns separately", () => {
		expect(
			getRequestRateLimitPolicy("POST", "/api/publication-concerns"),
		).toEqual({
			scope: "api:publication-concern",
			limit: 10,
			windowSeconds: 3600,
		});
	});

	it("limits authentication and privileged form actions", () => {
		expect(getRequestRateLimitPolicy("POST", "/auth")).toMatchObject({
			scope: "auth:action",
			limit: 30,
			windowSeconds: 900,
		});
		expect(
			getRequestRateLimitPolicy("POST", "/auth/update-password"),
		).toMatchObject({
			scope: "auth:password-update",
			limit: 10,
			windowSeconds: 3600,
		});
		expect(getRequestRateLimitPolicy("POST", "/profile")).toMatchObject({
			scope: "profile:action",
		});
		expect(getRequestRateLimitPolicy("POST", "/moderation")).toMatchObject({
			scope: "moderation:action",
		});
	});

	it("does not add database rate-limit work to ordinary page reads", () => {
		expect(
			getRequestRateLimitPolicy("GET", "/ingredients/fridge"),
		).toBeNull();
		expect(getRequestRateLimitPolicy("POST", "/auth/logout")).toBeNull();
	});
});
