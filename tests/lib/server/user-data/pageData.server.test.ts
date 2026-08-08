import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
	readCloudCustomFoodByFdcId: vi.fn(),
	readCloudCustomFoods: vi.fn(),
	readCloudMixPreferences: vi.fn(),
	readCloudSavedRecipes: vi.fn(),
	readCloudIngredientListIndex: vi.fn(),
}));
const serverLists = vi.hoisted(() => ({
	readCloudIngredientList: vi.fn(),
	readCloudIngredientListFood: vi.fn(),
	readCloudIngredientListPage: vi.fn(),
}));
const catalog = vi.hoisted(() => ({
	getApprovedCatalogRecordByApplicationFoodId: vi.fn(),
}));
const genericFoods = vi.hoisted(() => ({
	readGenericFoodByApplicationId: vi.fn(),
}));
const supabaseAdmin = vi.hoisted(() => ({
	client: { role: "service" },
	getSupabaseAdminClient: vi.fn(),
}));
const provenance = vi.hoisted(() => ({
	readIngredientProvenanceOptions: vi.fn(),
}));
const foodSafety = vi.hoisted(() => ({
	annotateFoodsWithFoodSafety: vi.fn((foods) => foods),
	getUserFoodSafetyContext: vi.fn(),
}));

vi.mock("$lib/utils/storage/supabase", () => storage);
vi.mock("$lib/server/user-data/foodLists.server", () => serverLists);
vi.mock("$lib/server/products/catalogRead.server", () => catalog);
vi.mock("$lib/server/products/genericFoods.server", () => genericFoods);
vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: supabaseAdmin.getSupabaseAdminClient,
}));
vi.mock("$lib/utils/ingredients/ingredientProvenance", () => provenance);
vi.mock("$lib/server/food-safety/foodSafetyEvaluation.server", () => ({
	annotateFoodsWithFoodSafety: foodSafety.annotateFoodsWithFoodSafety,
}));
vi.mock("$lib/server/food-safety/userFoodSafety.server", () => ({
	getUserFoodSafetyContext: foodSafety.getUserFoodSafetyContext,
}));

import {
	loadIngredientPageData,
	loadMixPageData,
	loadSavedPageData,
} from "$lib/server/user-data/pageData.server";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";

const context = {
	supabase: {} as never,
	userId: "user-1",
};
const listIndex = {
	[MIX_STORAGE_KEYS.fridge]: { foodIds: [1], foodIdentityKeys: ["fdc:1"] },
	[MIX_STORAGE_KEYS.shoppingList]: {
		foodIds: [2],
		foodIdentityKeys: ["fdc:2"],
	},
};

describe("server-loaded user page data", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		serverLists.readCloudIngredientListPage
			.mockResolvedValueOnce({ foods: [{ fdcId: 1 }], totalCount: 1 })
			.mockResolvedValueOnce({ foods: [{ fdcId: 2 }], totalCount: 1 });
		storage.readCloudCustomFoods.mockResolvedValue([{ fdcId: -1 }]);
		storage.readCloudCustomFoodByFdcId.mockResolvedValue(null);
		storage.readCloudIngredientListIndex.mockResolvedValue(listIndex);
		serverLists.readCloudIngredientListFood.mockResolvedValue(null);
		catalog.getApprovedCatalogRecordByApplicationFoodId.mockResolvedValue(null);
		genericFoods.readGenericFoodByApplicationId.mockResolvedValue(null);
    supabaseAdmin.getSupabaseAdminClient.mockReturnValue(supabaseAdmin.client);
		serverLists.readCloudIngredientList.mockImplementation(async (key: string) =>
			key === MIX_STORAGE_KEYS.fridge ? [{ fdcId: 1 }] : [{ fdcId: 2 }],
		);
		storage.readCloudMixPreferences.mockResolvedValue({
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
		storage.readCloudSavedRecipes.mockResolvedValue([{ id: "recipe-1" }]);
		provenance.readIngredientProvenanceOptions.mockResolvedValue([
			{ dimension: "trust", value: "source-verified" },
		]);
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

	it("loads the Ingredients page through one server coordinator", async () => {
		const result = await loadIngredientPageData(context);

		expect(result.fridge.totalCount).toBe(1);
		expect(result.shoppingList.totalCount).toBe(1);
		expect(result.customFoods).toEqual([{ fdcId: -1 }]);
		expect(result.routeFood).toBeNull();
		expect(result.listIndex).toEqual(listIndex);
		expect(result.loadError).toBe("");
		expect(serverLists.readCloudIngredientListPage).toHaveBeenCalledTimes(2);
	});

	it("hydrates the exact routed food even when it is outside the first page", async () => {
		serverLists.readCloudIngredientListFood.mockResolvedValueOnce({
			fdcId: 99,
			description: "Original Routed Food",
		});

		const result = await loadIngredientPageData(context, {
			routeFoodId: 99,
			routeListKey: MIX_STORAGE_KEYS.fridge,
		});

		expect(result.routeFood).toMatchObject({
			fdcId: 99,
			description: "Original Routed Food",
		});
		expect(serverLists.readCloudIngredientListFood).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.fridge,
			99,
			context,
		);
		expect(
			catalog.getApprovedCatalogRecordByApplicationFoodId,
		).not.toHaveBeenCalled();
	});

	it("uses the server catalog boundary for routed public foods", async () => {
		catalog.getApprovedCatalogRecordByApplicationFoodId.mockResolvedValueOnce({
			food: { fdcId: 99, description: "Catalog Routed Food" },
		});

		const result = await loadIngredientPageData(context, {
			routeFoodId: 99,
			routeListKey: MIX_STORAGE_KEYS.fridge,
		});

		expect(result.routeFood).toMatchObject({
			fdcId: 99,
			description: "Catalog Routed Food",
		});
		expect(
			catalog.getApprovedCatalogRecordByApplicationFoodId,
		).toHaveBeenCalledWith(supabaseAdmin.client, 99);
		expect(genericFoods.readGenericFoodByApplicationId).toHaveBeenCalledWith(
			supabaseAdmin.client,
			99,
		);
	});

	it("loads Mix lists and preferences together on the server", async () => {
		const result = await loadMixPageData(context);

		expect(result.fridge).toEqual([{ fdcId: 1 }]);
		expect(result.shoppingList).toEqual([{ fdcId: 2 }]);
    expect(result.preferences.nutrientGoals?.[1008]?.targetAmount).toBe(2000);
		expect(result.loadError).toBe("");
	});

	it("loads Saved data before rendering the page", async () => {
		const result = await loadSavedPageData(context);

		expect(result.recipes).toEqual([{ id: "recipe-1" }]);
		expect(result.loadError).toBe("");
	});

	it("returns an honest empty error state instead of stale browser data", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		storage.readCloudSavedRecipes.mockRejectedValueOnce(new Error("offline"));

		await expect(loadSavedPageData(context)).resolves.toEqual({
			recipes: [],
			loadError: "Your saved recipes could not be loaded. Try again.",
		});
	});

	it("returns an honest Ingredients error state without stale records", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		serverLists.readCloudIngredientListPage.mockReset();
		serverLists.readCloudIngredientListPage.mockRejectedValueOnce(
			new Error("offline"),
		);

		await expect(loadIngredientPageData(context)).resolves.toEqual({
			fridge: { foods: [], totalCount: 0 },
			shoppingList: { foods: [], totalCount: 0 },
			customFoods: [],
			routeFood: null,
			listIndex: {
				[MIX_STORAGE_KEYS.fridge]: {
					foodIds: [],
					foodIdentityKeys: [],
				},
				[MIX_STORAGE_KEYS.shoppingList]: {
					foodIds: [],
					foodIdentityKeys: [],
				},
			},
			provenanceOptions: [],
			loadError: "Saved ingredients could not be loaded. Try again.",
			provenanceError: "",
		});
	});

	it("returns an honest Mix error state without stale records", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		serverLists.readCloudIngredientList.mockRejectedValueOnce(
			new Error("offline"),
		);

		await expect(loadMixPageData(context)).resolves.toEqual({
			fridge: [],
			shoppingList: [],
			preferences: {},
			loadError: "Your saved ingredient lists could not be loaded. Try again.",
		});
	});
});
