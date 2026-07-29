import { beforeEach, describe, expect, it } from "vitest";
import {
	buildSavedDrinkExportText,
	formatSavedDrinkIngredientAmount,
} from "$lib/utils/recipes/recipeExport";
import { configureServingMeasureCatalog } from "$lib/utils/serving/servingMeasureCatalog";
import type { SavedDrink } from "$lib/utils/storage/client/savedDrinks";

const drink: SavedDrink = {
	id: "drink-1",
	name: "Berry Test",
	createdAt: 1,
	foods: [
		{
			fdcId: 1,
			description: "Strawberries",
			foodNutrients: [
				{
					nutrientId: 1008,
					nutrientName: "Energy",
					nutrientNumber: "208",
					unitName: "KCAL",
					value: 32,
				},
			],
		},
	],
	selected: [1008],
	options: [{ id: 1008, label: "Calories" }],
	nutrientGoals: {},
	servingGrams: { 1: 50 },
	servingQuantities: { 1: 0.5 },
	servingUnits: { 1: "cup" },
};

describe("saved recipe export", () => {
	beforeEach(() => {
		configureServingMeasureCatalog({
			options: [
				{
					value: "cup",
					label: "Cups",
					shortLabel: "cup",
					dimension: "volume",
					conversionToBase: 236.588,
					isDefault: false,
				},
			],
			aliases: {},
			aliasEntries: [],
		});
	});

	it("includes saved ingredient amounts and nutrition totals", () => {
		const text = buildSavedDrinkExportText(drink);

		expect(text).toContain("Berry Test");
		expect(text).toContain("- 0.5 cup Strawberries");
		expect(text).toContain("- Calories: 16 kcal");
		expect(formatSavedDrinkIngredientAmount(drink, 1)).toBe("0.5 cup");
	});

	it("uses zero without adding a partial-data warning when an ingredient lacks the nutrient", () => {
		const text = buildSavedDrinkExportText({
			...drink,
			foods: [
				...drink.foods,
				{ fdcId: 2, description: "Unknown Food", foodNutrients: [] },
			],
			servingGrams: { ...drink.servingGrams, 2: 20 },
		});

		expect(text).toContain("- Calories: 16 kcal");
		expect(text).not.toContain("partial");
	});
});
