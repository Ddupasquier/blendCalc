import { beforeEach, describe, expect, it, vi } from "vitest";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";

const cloudStorage = vi.hoisted(() => ({
	readCloudMixPreferences: vi.fn(),
}));
const ingredientLists = vi.hoisted(() => ({
	readCloudIngredientList: vi.fn(),
}));
const foodSafety = vi.hoisted(() => ({
	annotateFoodsWithFoodSafety: vi.fn((foods) => foods),
	getUserFoodSafetyContext: vi.fn(),
}));

vi.mock("$lib/utils/storage/supabase", () => cloudStorage);
vi.mock("$lib/server/user-data/foodLists.server", () => ingredientLists);
vi.mock("$lib/server/food-safety/foodSafetyEvaluation.server", () => ({
	annotateFoodsWithFoodSafety: foodSafety.annotateFoodsWithFoodSafety,
}));
vi.mock("$lib/server/food-safety/userFoodSafety.server", () => ({
	getUserFoodSafetyContext: foodSafety.getUserFoodSafetyContext,
}));

import { loadMixPageData } from "$lib/server/user-data/mixPageData.server";

const cloudDataContext = {
	supabase: {} as never,
	userId: "user-1",
};

describe("loadMixPageData", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		ingredientLists.readCloudIngredientList.mockImplementation(async (listKey: string) =>
			listKey === MIX_STORAGE_KEYS.fridge ? [{ fdcId: 1 }] : [{ fdcId: 2 }],
		);
		cloudStorage.readCloudMixPreferences.mockResolvedValue({
			nutrientGoals: {
				1008: {
					nutrientId: 1008,
					goalType: "exact",
					targetAmount: 2000,
					upperAmount: null,
					toleranceRatio: 0.1,
					importanceWeight: 1,
					sortOrder: 1,
				},
			},
			mixState: {},
		});
		foodSafety.getUserFoodSafetyContext.mockResolvedValue({
			profile: null,
			policy: {
				version: 1,
				reviewedAt: "2026-07-29T00:00:00.000Z",
				preferenceConflictRules: [],
				compatibilityMatchRules: [],
				regionalProfiles: [],
			},
		});
	});

	it("loads both ingredient lists and Mix preferences", async () => {
		const result = await loadMixPageData(cloudDataContext);

		expect(result.fridge).toEqual([{ fdcId: 1 }]);
		expect(result.shoppingList).toEqual([{ fdcId: 2 }]);
		expect(result.preferences.nutrientGoals?.[1008]?.targetAmount).toBe(2000);
		expect(result.loadError).toBe("");
	});

	it("returns an honest empty state when Mix data is unavailable", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		ingredientLists.readCloudIngredientList.mockRejectedValueOnce(
			new Error("offline"),
		);

		await expect(loadMixPageData(cloudDataContext)).resolves.toEqual({
			fridge: [],
			shoppingList: [],
			preferences: {},
			foodPreferences: null,
			loadError: "Your saved ingredient lists could not be loaded. Try again.",
		});
	});
});
