import { describe, expect, it } from "vitest";
import { NUTRIENT_IDS, type FoodItem } from "$lib/utils/food/types";
import { compareCatalogSubmissionToExistingProduct } from "$lib/utils/products/catalogSubmissionComparison";
import { mergeCatalogUpdateFood } from "$lib/utils/products/catalogUpdateMerge";

const nutrient = (nutrientId: number, value: number, unitName = "G") => ({
	nutrientId,
	nutrientName: `Nutrient ${nutrientId}`,
	nutrientNumber: String(nutrientId),
	unitName,
	value,
});

const currentFood: FoodItem = {
	fdcId: 42,
	description: "Example Oat Bar",
	brandOwner: "Example Foods",
	foodCategory: "Snack Bars",
	categories: ["Snack Bars"],
	customServingWeightGrams: 40,
	householdServingFullText: "1 bar",
	ingredients: "Oats, dates",
	allergens: [],
	traces: ["Peanut"],
	foodNutrients: [
		nutrient(NUTRIENT_IDS.CALORIES, 350, "KCAL"),
		nutrient(NUTRIENT_IDS.CARBS, 60),
		nutrient(NUTRIENT_IDS.CALCIUM, 80, "MG"),
	],
	reportedNutrientIds: [
		NUTRIENT_IDS.CALORIES,
		NUTRIENT_IDS.CARBS,
		NUTRIENT_IDS.CALCIUM,
	],
};

describe("catalog update merging", () => {
	it("updates reviewed fields without deleting unsubmitted canonical data", () => {
		const submittedFood: FoodItem = {
			...currentFood,
			customServingWeightGrams: 45,
			householdServingFullText: "1 larger bar",
			foodNutrients: [
				nutrient(NUTRIENT_IDS.CALORIES, 350, "KCAL"),
				nutrient(NUTRIENT_IDS.CARBS, 40),
			],
			reportedNutrientIds: [
				NUTRIENT_IDS.CALORIES,
				NUTRIENT_IDS.CARBS,
			],
		};
		const comparison = compareCatalogSubmissionToExistingProduct(
			submittedFood,
			currentFood,
		);
		const merged = mergeCatalogUpdateFood(
			currentFood,
			submittedFood,
			comparison.changes,
		);

		expect(merged.customServingWeightGrams).toBe(45);
		expect(merged.householdServingFullText).toBe("1 larger bar");
		expect(
			merged.foodNutrients.find(
				(item) => item.nutrientId === NUTRIENT_IDS.CARBS,
			)?.value,
		).toBe(40);
		expect(
			merged.foodNutrients.find(
				(item) => item.nutrientId === NUTRIENT_IDS.CALCIUM,
			)?.value,
		).toBe(80);
		expect(merged.ingredients).toBe("Oats, dates");
		expect(merged.traces).toEqual(["Peanut"]);
	});

	it("does not replace the canonical snapshot when no reviewed changes exist", () => {
		const submittedFood: FoodItem = {
			...currentFood,
			foodNutrients: [
				nutrient(NUTRIENT_IDS.CALORIES, 350, "KCAL"),
				nutrient(NUTRIENT_IDS.CARBS, 60),
			],
		};
		const merged = mergeCatalogUpdateFood(currentFood, submittedFood, []);

		expect(merged.description).toBe(currentFood.description);
		expect(merged.foodNutrients).toEqual(currentFood.foodNutrients);
		expect(merged.ingredients).toBe(currentFood.ingredients);
	});
});
