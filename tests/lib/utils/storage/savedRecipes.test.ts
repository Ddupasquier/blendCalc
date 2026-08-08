import { beforeEach, describe, expect, it, vi } from "vitest";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import type { FdcFood } from "$lib/utils/food/types";

const cloudData = vi.hoisted(() => ({
	deleteCloudSavedRecipe: vi.fn(),
	readCloudSavedRecipeById: vi.fn(),
	readCloudIngredientListIndex: vi.fn(),
	saveCloudSavedRecipeWithResult: vi.fn(),
  saveCloudMixGoalConfiguration: vi.fn(),
	saveCloudMixPreferences: vi.fn(),
}));
const listData = vi.hoisted(() => ({
	addFoodsToIngredientList: vi.fn(),
}));

vi.mock("$lib/utils/storage/supabase", () => cloudData);
vi.mock("$lib/utils/storage/client/ingredientLists", () => listData);

import {
	clearLoadedSavedRecipe,
	deleteSavedRecipe,
	normalizeSavedRecipe,
	readLoadedSavedRecipe,
	restoreSavedRecipeToMix,
	saveExistingSavedRecipe,
	saveNewSavedRecipe,
	type SavedRecipe,
	type SavedRecipeInput,
} from "$lib/utils/storage/client/savedRecipes";

const food = {
	fdcId: 1,
	description: "Bananas, Raw",
	nameProvenance: "source",
	foodNutrients: [],
} satisfies FdcFood;

const input = (name = "Post-workout"): SavedRecipeInput => ({
	name,
	foods: [food],
	selected: [1008],
	options: [{ id: 1008, label: "Calories" }],
  nutrientGoals: {
    1008: {
      nutrientId: 1008,
      goalType: "exact",
      targetAmount: 350,
      upperAmount: null,
      toleranceRatio: 0.1,
      importanceWeight: 1,
      sortOrder: 1,
    },
  },
  goalBasis: "per_mix",
	servingGrams: { 1: 100 },
	servingQuantities: { 1: 1 },
	servingUnits: { 1: "g" },
});

describe("database-backed saved recipes", () => {
	beforeEach(() => {
		localStorage.clear();
		sessionStorage.clear();
		vi.clearAllMocks();
		cloudData.deleteCloudSavedRecipe.mockResolvedValue(true);
		cloudData.readCloudIngredientListIndex.mockResolvedValue({
			[MIX_STORAGE_KEYS.fridge]: {
				foodIds: [food.fdcId],
				foodIdentityKeys: [`fdc:${food.fdcId}`],
			},
			[MIX_STORAGE_KEYS.shoppingList]: {
				foodIds: [],
				foodIdentityKeys: [],
			},
		});
		cloudData.saveCloudSavedRecipeWithResult.mockResolvedValue("saved");
    cloudData.saveCloudMixGoalConfiguration.mockResolvedValue(
      input().nutrientGoals,
    );
		cloudData.saveCloudMixPreferences.mockResolvedValue(true);
		listData.addFoodsToIngredientList.mockResolvedValue("added");
	});

	it("saves a new recipe directly to the database", async () => {
		const result = await saveNewSavedRecipe(input());

		expect(result).toMatchObject({ ok: true });
		expect(cloudData.saveCloudSavedRecipeWithResult).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Post-workout",
				foods: [expect.objectContaining({ fdcId: food.fdcId })],
			}),
		);
	});

	it("uses the database unique-name result", async () => {
		cloudData.saveCloudSavedRecipeWithResult.mockResolvedValue("duplicate");
		await expect(saveNewSavedRecipe(input())).resolves.toEqual({
			ok: false,
			reason: "duplicate",
		});
	});

	it("removes selected nutrients that do not have an explicit saved goal", () => {
		const recipe = {
			...input(),
			id: "recipe-1",
			createdAt: 123,
			selected: [1008, 1090],
			options: [
				{ id: 1008, label: "Calories" },
				{ id: 1090, label: "Magnesium" },
			],
		} satisfies SavedRecipe;

		expect(normalizeSavedRecipe(recipe)).toMatchObject({
			selected: [1008],
			options: [{ id: 1008, label: "Calories" }],
		});
	});

	it("updates the current database record without changing its creation time", async () => {
		const existing = {
			...input("Original"),
			id: "recipe-1",
			createdAt: 123,
		} satisfies SavedRecipe;
		cloudData.readCloudSavedRecipeById.mockResolvedValue(existing);

		const result = await saveExistingSavedRecipe(existing.id, input("Updated"));
		expect(result).toMatchObject({
			ok: true,
			recipe: { id: existing.id, name: "Updated", createdAt: 123 },
		});
	});

	it("returns missing when an update target is no longer in the database", async () => {
		cloudData.readCloudSavedRecipeById.mockResolvedValue(null);
		await expect(saveExistingSavedRecipe("missing", input())).resolves.toEqual({
			ok: false,
			reason: "missing",
		});
	});

	it("deletes only after database confirmation", async () => {
		await expect(deleteSavedRecipe("recipe-1")).resolves.toBe(true);
		cloudData.deleteCloudSavedRecipe.mockResolvedValue(false);
		await expect(deleteSavedRecipe("recipe-1")).resolves.toBe(false);
	});

	it("stores loaded-recipe context only for the current browser session", async () => {
		const recipe = {
			...input("High fiber"),
			id: "recipe-1",
			createdAt: 123,
		} satisfies SavedRecipe;

		await expect(restoreSavedRecipeToMix(recipe)).resolves.toBe(true);
		expect(readLoadedSavedRecipe()).toEqual({
			id: recipe.id,
			name: recipe.name,
			isDirty: false,
		});
		expect(localStorage.getItem("blendcalc-loaded-saved-recipe")).toBeNull();
		clearLoadedSavedRecipe();
		expect(readLoadedSavedRecipe()).toBeNull();
	});

	it("adds saved ingredients missing from both database lists", async () => {
		const kale = { ...food, fdcId: 2, description: "Kale, Raw" };
		const recipe = {
			...input("Green recipe"),
			id: "recipe-2",
			createdAt: 456,
			foods: [food, kale],
		} satisfies SavedRecipe;

		await expect(restoreSavedRecipeToMix(recipe)).resolves.toBe(true);
		expect(listData.addFoodsToIngredientList).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.shoppingList,
			[expect.objectContaining({ fdcId: kale.fdcId })],
		);
    expect(
      JSON.parse(localStorage.getItem(MIX_STORAGE_KEYS.mixState) ?? "{}"),
    ).toMatchObject({ selectedFoodIds: [food.fdcId, kale.fdcId] });
	});
});
