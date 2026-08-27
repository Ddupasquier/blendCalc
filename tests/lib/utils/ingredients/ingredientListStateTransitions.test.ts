import { describe, expect, it } from "vitest";
import type { FoodItem } from "$lib/utils/food/types";
import {
	addFoodToIngredientListViewState,
	moveFoodIdentityToIngredientListViewState,
	moveFoodsBetweenIngredientListsInViewState,
	removeFoodFromIngredientListViewState,
	renameFoodInIngredientListViewState,
	type IngredientListViewState,
} from "$lib/utils/ingredients/ingredientListStateTransitions";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";

const createFood = (
	fdcId: number,
	description: string,
	barcode?: string,
): FoodItem => ({
	fdcId,
	description,
	barcode,
	foodNutrients: [],
});

const createListViewState = ({
	fridgeFoods = [],
	shoppingListFoods = [],
}: {
	fridgeFoods?: FoodItem[];
	shoppingListFoods?: FoodItem[];
} = {}): IngredientListViewState => ({
	foodsByList: {
		[MIX_STORAGE_KEYS.fridge]: fridgeFoods,
		[MIX_STORAGE_KEYS.shoppingList]: shoppingListFoods,
	},
	totalCountsByList: {
		[MIX_STORAGE_KEYS.fridge]: fridgeFoods.length,
		[MIX_STORAGE_KEYS.shoppingList]: shoppingListFoods.length,
	},
	listIndex: {
		[MIX_STORAGE_KEYS.fridge]: {
			foodIds: fridgeFoods.map((food) => food.fdcId),
			foodIdentityKeys: fridgeFoods.map((food) =>
				food.barcode
					? `barcode:${food.barcode.padStart(14, "0")}`
					: `fdc:${food.fdcId}`,
			),
		},
		[MIX_STORAGE_KEYS.shoppingList]: {
			foodIds: shoppingListFoods.map((food) => food.fdcId),
			foodIdentityKeys: shoppingListFoods.map((food) =>
				food.barcode
					? `barcode:${food.barcode.padStart(14, "0")}`
					: `fdc:${food.fdcId}`,
			),
		},
	},
});

describe("ingredient list state transitions", () => {
	it("adds a food once while keeping rendered totals and identity index aligned", () => {
		const food = createFood(10, "Spinach");
		const addedState = addFoodToIngredientListViewState(
			createListViewState(),
			MIX_STORAGE_KEYS.fridge,
			food,
			1_000,
		);
		const duplicateState = addFoodToIngredientListViewState(
			addedState,
			MIX_STORAGE_KEYS.fridge,
			food,
			2_000,
		);

		expect(addedState.foodsByList[MIX_STORAGE_KEYS.fridge]).toEqual([
			{ ...food, listAddedAt: 1_000 },
		]);
		expect(addedState.totalCountsByList[MIX_STORAGE_KEYS.fridge]).toBe(1);
		expect(addedState.listIndex[MIX_STORAGE_KEYS.fridge]).toEqual({
			foodIds: [10],
			foodIdentityKeys: ["fdc:10"],
		});
		expect(duplicateState).toEqual(addedState);
	});

	it("removes the same food from the rendered list, count, and aligned index", () => {
		const spinach = createFood(10, "Spinach");
		const kale = createFood(11, "Kale");
		const nextState = removeFoodFromIngredientListViewState(
			createListViewState({ fridgeFoods: [spinach, kale] }),
			MIX_STORAGE_KEYS.fridge,
			spinach.fdcId,
		);

		expect(nextState.foodsByList[MIX_STORAGE_KEYS.fridge]).toEqual([kale]);
		expect(nextState.totalCountsByList[MIX_STORAGE_KEYS.fridge]).toBe(1);
		expect(nextState.listIndex[MIX_STORAGE_KEYS.fridge]).toEqual({
			foodIds: [11],
			foodIdentityKeys: ["fdc:11"],
		});
	});

	it("renames only the requested list item and preserves its canonical name", () => {
		const food = createFood(10, "Spinach");
		const nextState = renameFoodInIngredientListViewState(
			createListViewState({
				fridgeFoods: [food],
				shoppingListFoods: [food],
			}),
			MIX_STORAGE_KEYS.fridge,
			food.fdcId,
			"Salad spinach",
		);

		expect(nextState.foodsByList[MIX_STORAGE_KEYS.fridge][0]).toMatchObject({
			description: "Salad spinach",
			canonicalDescription: "Spinach",
			nameProvenance: "user",
		});
		expect(
			nextState.foodsByList[MIX_STORAGE_KEYS.shoppingList][0].description,
		).toBe("Spinach");
	});

	it("moves an exact barcode identity and reports every removed source id", () => {
		const savedFood = createFood(10, "Old label", "123456789012");
		const searchFood = createFood(20, "Current label", "123456789012");
		const { nextState, removedSourceFoodIds } =
			moveFoodIdentityToIngredientListViewState(
				createListViewState({ shoppingListFoods: [savedFood] }),
				MIX_STORAGE_KEYS.fridge,
				searchFood,
				3_000,
			);

		expect(removedSourceFoodIds).toEqual([10]);
		expect(nextState.foodsByList[MIX_STORAGE_KEYS.shoppingList]).toEqual([]);
		expect(nextState.foodsByList[MIX_STORAGE_KEYS.fridge]).toEqual([
			{ ...searchFood, listAddedAt: 3_000 },
		]);
		expect(nextState.totalCountsByList).toEqual({
			[MIX_STORAGE_KEYS.fridge]: 1,
			[MIX_STORAGE_KEYS.shoppingList]: 0,
		});
		expect(nextState.listIndex[MIX_STORAGE_KEYS.fridge].foodIds).toEqual([20]);
	});

	it("moves a selected batch together with one shared placement timestamp", () => {
		const spinach = createFood(10, "Spinach");
		const kale = createFood(11, "Kale");
		const milk = createFood(12, "Milk");
		const nextState = moveFoodsBetweenIngredientListsInViewState(
			createListViewState({
				fridgeFoods: [spinach, kale],
				shoppingListFoods: [milk],
			}),
			MIX_STORAGE_KEYS.fridge,
			[spinach, kale],
			4_000,
		);

		expect(nextState.foodsByList[MIX_STORAGE_KEYS.fridge]).toEqual([]);
		expect(nextState.foodsByList[MIX_STORAGE_KEYS.shoppingList]).toEqual([
			{ ...spinach, listAddedAt: 4_000 },
			{ ...kale, listAddedAt: 4_000 },
			milk,
		]);
		expect(nextState.totalCountsByList).toEqual({
			[MIX_STORAGE_KEYS.fridge]: 0,
			[MIX_STORAGE_KEYS.shoppingList]: 3,
		});
		expect(nextState.listIndex[MIX_STORAGE_KEYS.shoppingList].foodIds).toEqual([
			10, 11, 12,
		]);
	});
});
