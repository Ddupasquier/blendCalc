import {
	getRequestRateLimitLayers,
	getRequestRateLimitPolicy,
} from "$lib/server/security/requestRateLimit.server";
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
			getRequestRateLimitPolicy("POST", "/api/intake/v1/product-observations"),
		).toMatchObject({
			scope: "catalog:submission",
			limit: 10,
			windowSeconds: 3600,
		});
		expect(
			getRequestRateLimitPolicy("POST", "/api/food-compatibility/feedback"),
		).toMatchObject({
			scope: "compatibility:feedback",
			limit: 30,
			windowSeconds: 3600,
		});
	});

	it("bounds authenticated intake status polling", () => {
		expect(
			getRequestRateLimitPolicy(
				"GET",
				"/api/intake/v1/submissions/11111111-1111-4111-8111-111111111111",
			),
		).toEqual({
			scope: "catalog:intake-status",
			limit: 60,
			windowSeconds: 60,
		});
	});

	it("allows normal search traffic without leaving it unbounded", () => {
		expect(getRequestRateLimitPolicy("GET", "/api/foods/search")).toMatchObject(
			{
				scope: "food:search",
				limit: 180,
				windowSeconds: 60,
			},
		);
	});

	it("limits signed-out publication concerns separately", () => {
		expect(
			getRequestRateLimitPolicy("POST", "/api/publication-concerns"),
		).toEqual({
			scope: "blendCalcAPI:publication-concern",
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
		expect(getRequestRateLimitPolicy("GET", "/ingredients/fridge")).toBeNull();
		expect(getRequestRateLimitPolicy("POST", "/auth/logout")).toBeNull();
	});

	it("leaves secret-authenticated internal routes independent of database rate limiting", () => {
		expect(
			getRequestRateLimitPolicy(
				"GET",
				"/api/internal/food-safety/fda-recall-source",
			),
		).toBeNull();
		expect(
			getRequestRateLimitPolicy("GET", "/api/internal/analytics/sync"),
		).toBeNull();
	});

	it("layers burst and sustained endpoint limits across every available identity", () => {
		const layers = getRequestRateLimitLayers({
			apiKey: "key-id",
			clientAddress: "192.0.2.1",
			method: "GET",
			pathname: "/api/v1/categories",
			userId: "user-id",
		});
		expect(layers).toHaveLength(6);
		expect(layers.map(({ scope }) => scope)).toEqual([
			"api-v1:read:ip:burst",
			"api-v1:read:ip:sustained",
			"api-v1:read:account:burst",
			"api-v1:read:account:sustained",
			"api-v1:read:key:burst",
			"api-v1:read:key:sustained",
		]);
		expect(layers[0]).toMatchObject({ limit: 180, windowSeconds: 60 });
		expect(layers[1]).toMatchObject({ limit: 1080, windowSeconds: 600 });
	});
});
