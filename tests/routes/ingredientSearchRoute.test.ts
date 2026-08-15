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
	foodNutrients: [{
		nutrientId: 1008,
		nutrientName: "Energy",
		nutrientNumber: "208",
		unitName: "kcal",
		value: 100,
	}],
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
			async (_client, foods: FoodItem[]) => foods.map((food) => ({
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
		expect(mocks.hydrateFoodsWithCachedImages).toHaveBeenCalledTimes(1);
		expect(mocks.hydrateFoodsWithCachedImages.mock.calls[0][0]).toBe(
			mocks.adminClient,
		);
		expect(
			mocks.hydrateFoodsWithCachedImages.mock.calls[0][1],
		).toHaveLength(2);
		const body = await response.json();
		expect(body.foods).toHaveLength(2);
		expect(body.foods[0].image.imageUrl).toContain("example.com");
		expect(body.total).toBe(3);
	});
});
