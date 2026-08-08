import { describe, expect, it } from "vitest";
import {
	getIngredientPillSpan,
	packIngredientPills,
} from "$lib/components/saved/SavedRecipeIngredientPills/ingredientPillLayout";
import type { FoodItem } from "$lib/utils/food/types";

const food = (
	fdcId: number,
	description: string,
	overrides: Partial<FoodItem> = {},
): FoodItem => ({
	fdcId,
	description,
	foodNutrients: [],
	...overrides,
});

describe("saved ingredient pill packing", () => {
	it("sizes labels into bounded responsive spans", () => {
		expect(getIngredientPillSpan(food(1, "Spinach, Raw"))).toBe(5);
		expect(getIngredientPillSpan(food(2, "Tomatoes, Green, Raw"))).toBe(6);
		expect(
			getIngredientPillSpan(
				food(3, "Milk, Reduced Fat, Fluid, 2% Milkfat"),
			),
		).toBe(7);
		expect(
			getIngredientPillSpan(
				food(
					4,
					"Beef, Australian, Imported, Grass-Fed, Ribeye Steak, Roasted",
				),
			),
		).toBe(12);
	});

	it("packs complementary sizes together without exceeding a row", () => {
		const packed = packIngredientPills([
			food(1, "Tomatoes, Green, Raw"),
			food(2, "Spinach, Raw"),
			food(3, "Greek Yogurt"),
			food(4, "Chia Seeds, Dried"),
		]);

		expect(packed.map(({ food: item }) => item.description)).toEqual([
			"Tomatoes, Green, Raw",
			"Chia Seeds, Dried",
			"Spinach, Raw",
			"Greek Yogurt",
		]);
		expect(packed.map(({ span }) => span)).toEqual([6, 5, 5, 5]);
	});

	it("keeps full-width labels isolated and retains every ingredient once", () => {
		const foods = [
			food(
				1,
				"Beef, Australian, Imported, Grass-Fed, Ribeye Steak, Roasted",
			),
			food(2, "Spinach, Raw"),
			food(3, "Tomatoes, Green, Raw"),
		];
		const packed = packIngredientPills(foods);

		expect(packed[0].span).toBe(12);
		expect(packed.map(({ food: item }) => item.fdcId).sort()).toEqual([1, 2, 3]);
	});
});
