import { describe, expect, it } from "vitest";
import type { FoodItem } from "$lib/utils/food/types";
import { paginateIngredientSearchResults } from "$lib/utils/ingredients/ingredientSearchPagination";

const makeFood = (fdcId: number): FoodItem => ({
	fdcId,
	description: `Food ${fdcId}`,
	foodNutrients: [],
});

describe("paginateIngredientSearchResults", () => {
	it("returns a stable page and the next server offset", () => {
		const foods = Array.from({ length: 10 }, (_, index) => makeFood(index + 1));

		expect(paginateIngredientSearchResults(foods, 0, 4)).toEqual({
			foods: foods.slice(0, 4),
			hasMore: true,
			nextOffset: 4,
			total: 10,
		});
		expect(paginateIngredientSearchResults(foods, 4, 4)).toEqual({
			foods: foods.slice(4, 8),
			hasMore: true,
			nextOffset: 8,
			total: 10,
		});
	});

	it("ends pagination when the final page is reached", () => {
		const foods = Array.from({ length: 5 }, (_, index) => makeFood(index + 1));

		expect(paginateIngredientSearchResults(foods, 4, 4)).toEqual({
			foods: foods.slice(4),
			hasMore: false,
			nextOffset: null,
			total: 5,
		});
	});
});
