import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FoodItem } from "$lib/utils/food/types";

const mocks = vi.hoisted(() => ({
	adminClient: { source: "trusted-server" },
	annotateFoodsWithFoodSafety: vi.fn(),
	areExternalProductLookupsEnabled: vi.fn(),
	getNutritionCompletenessCatalog: vi.fn(),
	getSupabaseAdminClient: vi.fn(),
	getUserFoodSafetyContext: vi.fn(),
	hydrateFoodsWithCachedImages: vi.fn(),
	searchApprovedSharedProducts: vi.fn(),
	searchGenericFoods: vi.fn(),
	searchUserCustomFoods: vi.fn(),
	searchUsdaFoods: vi.fn(),
}));

vi.mock("$lib/server/products/catalog.server", () => ({
	searchApprovedSharedProducts: mocks.searchApprovedSharedProducts,
}));
vi.mock("$lib/server/products/customFoods.server", () => ({
	searchUserCustomFoods: mocks.searchUserCustomFoods,
}));
vi.mock("$lib/server/products/externalProductPolicy.server", () => ({
	areExternalProductLookupsEnabled: mocks.areExternalProductLookupsEnabled,
}));
vi.mock("$lib/server/products/usdaCache.server", () => ({
	searchUsdaFoods: mocks.searchUsdaFoods,
}));
vi.mock("$lib/server/products/genericFoods.server", () => ({
	searchGenericFoods: mocks.searchGenericFoods,
}));
vi.mock("$lib/server/nutrition/nutritionCompletenessCatalog.server", () => ({
	getNutritionCompletenessCatalog: mocks.getNutritionCompletenessCatalog,
}));
vi.mock("$lib/server/food-safety/userFoodSafety.server", () => ({
	getUserFoodSafetyContext: mocks.getUserFoodSafetyContext,
}));
vi.mock("$lib/server/food-safety/foodSafetyEvaluation.server", () => ({
	annotateFoodsWithFoodSafety: mocks.annotateFoodsWithFoodSafety,
}));
vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));
vi.mock("$lib/utils/storage/supabase/foodImages", () => ({
	hydrateFoodsWithCachedImages: mocks.hydrateFoodsWithCachedImages,
}));

import { GET } from "../../src/routes/api/foods/search/+server";

const makeFood = (fdcId: number, description: string): FoodItem => ({
	fdcId,
	description,
	foodCategory: "Test foods",
	foodNutrients: [
		{
			nutrientId: 1008,
			nutrientName: "Energy",
			nutrientNumber: "208",
			unitName: "kcal",
			value: 100,
		},
	],
	dataType: "Shared Product",
	sharedProductId: `shared-${fdcId}`,
});

describe("ingredient search route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getSupabaseAdminClient.mockReturnValue(mocks.adminClient);
		mocks.areExternalProductLookupsEnabled.mockReturnValue(false);
		mocks.searchUserCustomFoods.mockResolvedValue([]);
		mocks.searchGenericFoods.mockResolvedValue([]);
		mocks.getNutritionCompletenessCatalog.mockResolvedValue(undefined);
		mocks.getUserFoodSafetyContext.mockResolvedValue({});
		mocks.annotateFoodsWithFoodSafety.mockImplementation((foods) => foods);
		mocks.hydrateFoodsWithCachedImages.mockImplementation(
			async (_client, foods: FoodItem[]) =>
				foods.map((food) => ({
					...food,
					image: { imageUrl: `https://example.com/${food.fdcId}.jpg` },
				})),
		);
	});

	it("hydrates images only for the visible page after ranking", async () => {
		mocks.searchApprovedSharedProducts.mockResolvedValue([
			makeFood(1, "Apple, raw"),
			makeFood(2, "Apple, dried"),
			makeFood(3, "Apple sauce"),
		]);
		const locals = {
			getVerifiedUser: vi.fn().mockResolvedValue({ id: "user-id" }),
			supabase: { source: "authenticated-browser" },
		};

		const response = await GET({
			locals,
			url: new URL("http://localhost/api/foods/search?q=apple&limit=2"),
		} as never);

		expect(response.status).toBe(200);
		expect(mocks.annotateFoodsWithFoodSafety).toHaveBeenCalledTimes(1);
		expect(mocks.annotateFoodsWithFoodSafety.mock.calls[0][0]).toHaveLength(3);
		expect(mocks.hydrateFoodsWithCachedImages).toHaveBeenCalledTimes(1);
		expect(mocks.hydrateFoodsWithCachedImages.mock.calls[0][0]).toBe(
			mocks.adminClient,
		);
		expect(mocks.hydrateFoodsWithCachedImages.mock.calls[0][1]).toHaveLength(2);
		const body = await response.json();
		expect(body.foods).toHaveLength(2);
		expect(body.foods[0].image.imageUrl).toContain("example.com");
		expect(body.total).toBe(3);
	});

	it("filters current warning evidence before paginating search results", async () => {
		const ordinaryFood = makeFood(1, "Apple, raw");
		const warningFood = {
			...makeFood(2, "Apple yogurt"),
			preferenceWarnings: [
				{
					id: "milk-warning",
					level: "warning" as const,
					category: "allergen" as const,
					label: "Milk",
					code: "FOOD_ALLERGEN_CONTAINS",
					params: {},
				},
			],
		};
		const recalledFood = {
			...makeFood(3, "Recalled apple salad"),
			safetyAlerts: [
				{
					id: "recall-1",
					providerKey: "open-fda-food-enforcement",
					sourceName: "openFDA Food Enforcement",
					sourceAttribution: "U.S. Food and Drug Administration",
					alertType: "recall" as const,
					status: "Ongoing",
					productDescription: "Recalled apple salad",
					sourceUrl: "https://api.fda.gov/food/enforcement.json",
					matchType: "exact_gtin" as const,
					requiresPackageCheck: false,
					detectedAt: "2026-08-14T12:00:00.000Z",
				},
			],
		};
		mocks.searchApprovedSharedProducts.mockResolvedValue([
			ordinaryFood,
			warningFood,
			recalledFood,
		]);
		mocks.annotateFoodsWithFoodSafety.mockReturnValue([
			ordinaryFood,
			warningFood,
			recalledFood,
		]);
		const locals = {
			getVerifiedUser: vi.fn().mockResolvedValue({ id: "user-id" }),
			supabase: { source: "authenticated-browser" },
		};

		const warningResponse = await GET({
			locals,
			url: new URL(
				"http://localhost/api/foods/search?q=apple&limit=1&safety=warnings",
			),
		} as never);
		const recallResponse = await GET({
			locals,
			url: new URL(
				"http://localhost/api/foods/search?q=apple&limit=1&safety=active-recalls",
			),
		} as never);

		expect(await warningResponse.json()).toMatchObject({
			foods: [expect.objectContaining({ fdcId: 2 })],
			total: 1,
		});
		expect(await recallResponse.json()).toMatchObject({
			foods: [expect.objectContaining({ fdcId: 3 })],
			total: 1,
		});
	});

	it("rejects unknown safety filters", async () => {
		const locals = {
			getVerifiedUser: vi.fn().mockResolvedValue({ id: "user-id" }),
			supabase: { source: "authenticated-browser" },
		};

		await expect(
			GET({
				locals,
				url: new URL(
					"http://localhost/api/foods/search?q=apple&safety=unknown",
				),
			} as never),
		).rejects.toMatchObject({ status: 400 });
	});
});
