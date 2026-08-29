import { beforeEach, describe, expect, it, vi } from "vitest";

const cloudStorage = vi.hoisted(() => ({
	readCloudSavedRecipes: vi.fn(),
}));

const foodSafety = vi.hoisted(() => ({
	annotateFoodsWithFoodSafety: vi.fn(),
	getUserFoodSafetyContext: vi.fn(),
}));

vi.mock("$lib/utils/storage/supabase", () => cloudStorage);
vi.mock("$lib/server/food-safety/foodSafetyEvaluation.server", () => ({
	annotateFoodsWithFoodSafety: foodSafety.annotateFoodsWithFoodSafety,
}));
vi.mock("$lib/server/food-safety/userFoodSafety.server", () => ({
	getUserFoodSafetyContext: foodSafety.getUserFoodSafetyContext,
}));

import { loadSavedRecipesPageData } from "$lib/server/user-data/savedRecipesPageData.server";

const cloudDataContext = {
	supabase: {} as never,
	userId: "user-1",
};

describe("loadSavedRecipesPageData", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		cloudStorage.readCloudSavedRecipes.mockResolvedValue([
			{ id: "recipe-1", foods: [{ fdcId: 1 }] },
		]);
		foodSafety.getUserFoodSafetyContext.mockResolvedValue({
			policy: "current",
		});
		foodSafety.annotateFoodsWithFoodSafety.mockReturnValue([
			{ fdcId: 1, preferenceWarnings: [{ id: "warning-1" }] },
		]);
	});

	it("loads saved recipes before rendering the Saved page", async () => {
		const result = await loadSavedRecipesPageData(cloudDataContext);

		expect(result.recipes).toEqual([
			{
				id: "recipe-1",
				foods: [{ fdcId: 1, preferenceWarnings: [{ id: "warning-1" }] }],
			},
		]);
		expect(result.loadError).toBe("");
		expect(foodSafety.annotateFoodsWithFoodSafety).toHaveBeenCalledWith(
			[{ fdcId: 1 }],
			{ policy: "current" },
		);
	});

	it("returns an honest empty state when saved recipes are unavailable", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		cloudStorage.readCloudSavedRecipes.mockRejectedValueOnce(
			new Error("offline"),
		);

		await expect(loadSavedRecipesPageData(cloudDataContext)).resolves.toEqual({
			recipes: [],
			loadError: "Your saved recipes could not be loaded. Try again.",
		});
	});
});
