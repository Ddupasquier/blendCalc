import { describe, expect, it } from "vitest";
import {
	isUsableIngredientSearchResult,
	mergeIngredientSearchResults,
} from "$lib/utils/ingredients/ingredientSearchResults";
import type { FoodItem } from "$lib/utils/food/types";

const food = (overrides: Partial<FoodItem> = {}): FoodItem => ({
	fdcId: 1,
	description: "Test Food",
	foodNutrients: [{
		nutrientId: 1008,
		nutrientName: "Energy",
		nutrientNumber: "208",
		unitName: "kcal",
		value: 100,
	}],
	...overrides,
});

describe("ingredient search result merging", () => {
	it("prefers the richer exact legacy record across sources", () => {
		const usda = food({
			fdcId: 171032,
			description: "Oil, Apricot Kernel",
			sourceIdentifiers: {
				usdaFdcId: "171032",
				usdaNdbNumber: "04530",
			},
		});
		const cnf = food({
			fdcId: -4491358547542380,
			description: "Vegetable Oil, Apricot Kernel",
			sourceIdentifiers: {
				datasetFoodKey: "cnf-2026:441",
				usdaNdbNumber: "04530",
			},
			foodNutrients: [
				...usda.foodNutrients,
				{
					nutrientId: 1004,
					nutrientName: "Total Fat",
					nutrientNumber: "204",
					unitName: "g",
					value: 100,
				},
			],
			foodServings: [{
				label: "15 ml",
				gramWeight: 13.784,
				isPrimary: true,
				source: "health-canada-cnf",
			}],
		});

		expect(mergeIngredientSearchResults([usda], [cnf])).toEqual([cnf]);
	});

	it("keeps unrelated records and removes duplicate ids", () => {
		const first = food();
		const richerDuplicate = food({
			foodNutrients: [
				...first.foodNutrients,
				{
					nutrientId: 1003,
					nutrientName: "Protein",
					nutrientNumber: "203",
					unitName: "g",
					value: 1,
				},
			],
		});
		const other = food({ fdcId: 2, description: "Other Food" });

		expect(mergeIngredientSearchResults([first, other], [richerDuplicate]))
			.toEqual([richerDuplicate, other]);
	});

	it("keeps the canonical shared-catalog record ahead of a richer provider duplicate", () => {
		const catalogFood = food({
			fdcId: -1,
			barcode: "00041570054130",
			sharedProductId: "shared-product-id",
			dataType: "Shared Product",
		});
		const providerFood = food({
			fdcId: 2757275,
			barcode: "00041570054130",
			foodNutrients: [
				...catalogFood.foodNutrients,
				{
					nutrientId: 1003,
					nutrientName: "Protein",
					nutrientNumber: "203",
					unitName: "g",
					value: 1,
				},
			],
		});

		expect(mergeIngredientSearchResults([catalogFood], [providerFood]))
			.toEqual([catalogFood]);
		expect(mergeIngredientSearchResults([providerFood], [catalogFood]))
			.toEqual([catalogFood]);
	});
});

describe("usable ingredient search results", () => {
	it("keeps nutrient-bearing foods and rejects nutritionally empty records", () => {
		expect(isUsableIngredientSearchResult(food())).toBe(true);
		expect(isUsableIngredientSearchResult(food({ foodNutrients: [] }))).toBe(false);
	});
});
