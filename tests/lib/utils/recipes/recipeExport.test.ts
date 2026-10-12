import { beforeEach, describe, expect, it } from "vitest";
import {
	buildSavedRecipeExportText,
	formatSavedRecipeIngredientAmount,
} from "$lib/utils/recipes/recipeExport";
import { configureServingMeasureCatalog } from "$lib/utils/serving/servingMeasureCatalog";
import type { SavedRecipe } from "$lib/utils/storage/client/savedRecipes";

const recipe: SavedRecipe = {
	id: "recipe-1",
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
	goalBasis: "per_mix",
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
		const text = buildSavedRecipeExportText(recipe);

		expect(text).toContain("Berry Test");
		expect(text).toContain("- 0.5 cup Strawberries");
		expect(text).toContain("- Calories: 16 kcal");
		expect(formatSavedRecipeIngredientAmount(recipe, 1)).toBe("0.5 cup");
	});

	it("labels a known subtotal when an ingredient lacks the nutrient", () => {
		const text = buildSavedRecipeExportText({
			...recipe,
			foods: [
				...recipe.foods,
				{ fdcId: 2, description: "Unknown Food", foodNutrients: [] },
			],
			servingGrams: { ...recipe.servingGrams, 2: 20 },
		});

		expect(text).toContain(
			"- Calories: 16 kcal known; total incomplete (1 of 2 ingredients)",
		);
		expect(text).toContain("Nutrition is incomplete");
	});
	it("keeps all-missing nutrition unknown instead of inventing zero", () => {
		const text = buildSavedRecipeExportText({
			...recipe,
			foods: [{ ...recipe.foods[0], foodNutrients: [] }],
		});
		expect(text).toContain("- Calories: Unknown (no calculable nutrient data)");
		expect(text).not.toContain("Calories: 0");
	});

	it("preserves a genuine zero and does not call complete data incomplete", () => {
		const text = buildSavedRecipeExportText({
			...recipe,
			foods: [
				{
					...recipe.foods[0],
					foodNutrients: [
						{
							...recipe.foods[0].foodNutrients[0],
							value: 0,
							valueStatus: "reported-zero",
						},
					],
				},
			],
		});
		expect(text).toContain("- Calories: 0 kcal");
		expect(text).not.toContain("incomplete");
	});

	it("distinguishes a known zero subtotal from the entirely unknown total", () => {
		const text = buildSavedRecipeExportText({
			...recipe,
			foods: [
				{
					...recipe.foods[0],
					foodNutrients: [{ ...recipe.foods[0].foodNutrients[0], value: 0 }],
				},
				{ fdcId: 2, description: "Unknown", foodNutrients: [] },
			],
		});
		expect(text).toContain(
			"Calories: 0 kcal known; total incomplete (1 of 2 ingredients)",
		);
	});

	it.each(["missing", "invalid", "unknown", "present-unquantified"] as const)(
		"does not count a %s placeholder as a reported zero",
		(valueStatus) => {
			const text = buildSavedRecipeExportText({
				...recipe,
				foods: [
					{
						...recipe.foods[0],
						foodNutrients: [
							{ ...recipe.foods[0].foodNutrients[0], value: 0, valueStatus },
						],
					},
				],
			});
			expect(text).toContain("Calories: Unknown");
		},
	);

	it.each([NaN, Infinity, -1])(
		"refuses invalid numeric nutrition %s",
		(value) => {
			const text = buildSavedRecipeExportText({
				...recipe,
				foods: [
					{
						...recipe.foods[0],
						foodNutrients: [{ ...recipe.foods[0].foodNutrients[0], value }],
					},
				],
			});
			expect(text).toContain("Calories: Unknown");
		},
	);

	it("does not silently use default amounts when none were saved", () => {
		const text = buildSavedRecipeExportText({
			...recipe,
			servingGrams: {},
			servingQuantities: {},
			servingUnits: {},
		});
		expect(text).toContain("Amount not saved Strawberries");
		expect(text).toContain("Calories: Unknown");
	});

	it("does not invent a mass conversion for a volume-only serving", () => {
		const text = buildSavedRecipeExportText({ ...recipe, servingGrams: {} });
		expect(text).toContain("Calories: Unknown");
	});

	it("scales native volume nutrition through the saved volume basis", () => {
		const text = buildSavedRecipeExportText({
			...recipe,
			servingGrams: {},
			foods: [
				{
					...recipe.foods[0],
					foodNutrients: [
						{
							...recipe.foods[0].foodNutrients[0],
							value: 100,
							measurementBasis: {
								kind: "volume",
								quantity: 236.588,
								unitKey: "ml",
							},
						},
					],
				},
			],
		});
		expect(text).toContain("Calories: 50 kcal");
		expect(text).not.toContain("incomplete");
	});

	it("refuses to combine incompatible nutrient units", () => {
		const text = buildSavedRecipeExportText({
			...recipe,
			foods: [
				...recipe.foods,
				{
					...recipe.foods[0],
					fdcId: 2,
					foodNutrients: [
						{ ...recipe.foods[0].foodNutrients[0], unitName: "KJ" },
					],
				},
			],
			servingGrams: { ...recipe.servingGrams, 2: 100 },
		});
		expect(text).toContain("Calories: Unknown (incompatible nutrient units)");
	});

	it("exports a snapshot without changing recipe contents or saved amounts", () => {
		const snapshot = structuredClone(recipe);
		const before = structuredClone(snapshot);
		buildSavedRecipeExportText(snapshot);
		expect(snapshot).toEqual(before);
	});
});
