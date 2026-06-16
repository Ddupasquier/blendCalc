import { describe, expect, it } from "vitest";
import {
	mapFdcBarcodeFood,
	mapOpenFoodFactsProduct,
	mapSharedCatalogFood,
} from "$lib/utils/barcode/productLookup";
import { NUTRIENT_IDS } from "$lib/utils/food/types";

describe("barcode product mapping", () => {
	it("converts Open Food Facts per-100g values to the label serving", () => {
		const draft = mapOpenFoodFactsProduct(
			{
				product_name: "Test cereal",
				brands: "Example Brand",
				serving_size: "2 tbsp (30 g)",
				serving_quantity: 30,
				nutriments: {
					"energy-kcal_100g": 500,
					fat_100g: 10,
					carbohydrates_100g: 60,
					fiber_100g: 8,
					sugars_100g: 20,
					proteins_100g: 12,
					"saturated-fat_100g": 4,
					"saturated-fat_unit": "g",
					sodium_100g: 0.5,
					sodium_unit: "g",
					calcium_100g: 120,
					calcium_unit: "mg",
				},
			},
			"4006381333931",
		);

		expect(draft).toMatchObject({
			barcode: "04006381333931",
			name: "Test cereal",
			brandOwner: "Example Brand",
			servingWeightGrams: 30,
			nutrition: {
				calories: 150,
				fat: 3,
				carbs: 18,
				fiber: 2.4,
				sugar: 6,
				protein: 3.6,
			},
		});
		expect(draft?.volumeEquivalent).toEqual({ quantity: 2, unit: "tbsp" });
		expect(draft?.additionalNutrients).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ nutrientId: 1258, value: 1.2, unitName: "G" }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.SODIUM, value: 150, unitName: "MG" }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.CALCIUM, value: 36, unitName: "MG" }),
			]),
		);
		expect(draft?.reportedNutrientIds).toEqual(
			expect.arrayContaining([
				NUTRIENT_IDS.CALORIES,
				NUTRIENT_IDS.SODIUM,
				NUTRIENT_IDS.CALCIUM,
			]),
		);
	});

	it("does not infer density from a volume-only serving", () => {
		const draft = mapOpenFoodFactsProduct(
			{
				product_name: "Test drink",
				serving_size: "355 ml",
				serving_quantity: 355,
				serving_quantity_unit: "ml",
				nutriments: { "energy-kcal_100g": 1 },
			},
			"049000042566",
		);

		expect(draft?.servingWeightGrams).toBe(100);
		expect(draft?.servingLabel).toBe("100 g");
		expect(draft?.volumeEquivalent).toBeUndefined();
	});

	it("keeps Open Food Facts ingredient and allergen metadata", () => {
		const draft = mapOpenFoodFactsProduct(
			{
				product_name: "Test yogurt",
				ingredients_text_en: "Cultured milk, honey, pectin",
				allergens_tags: ["en:milk"],
				traces: "tree nuts",
				labels_tags: ["en:gluten-free"],
				categories_tags: ["en:yogurts"],
				nutriments: { "energy-kcal_100g": 100 },
			},
			"049000042566",
		);

		expect(draft).toMatchObject({
			ingredients: "Cultured milk, honey, pectin",
			ingredientList: ["Cultured milk", "honey", "pectin"],
			allergens: ["milk"],
			traces: ["tree nuts"],
			dietaryTags: ["gluten free"],
			categories: ["yogurts"],
		});
	});

	it("converts USDA per-100g branded values to the serving", () => {
		const draft = mapFdcBarcodeFood(
			{
				fdcId: 123,
				description: "Test snack",
				brandOwner: "Example Brand",
				ingredients: "Corn, sunflower oil, salt",
				allergens: ["corn"],
				servingSize: 50,
				servingSizeUnit: "g",
				householdServingFullText: "2 tbsp",
				foodNutrients: [
					{ nutrientId: NUTRIENT_IDS.CALORIES, nutrientName: "Energy", nutrientNumber: "208", unitName: "KCAL", value: 400 },
					{ nutrientId: NUTRIENT_IDS.FAT, nutrientName: "Fat", nutrientNumber: "204", unitName: "G", value: 12 },
					{ nutrientId: NUTRIENT_IDS.CARBS, nutrientName: "Carbs", nutrientNumber: "205", unitName: "G", value: 50 },
					{ nutrientId: NUTRIENT_IDS.FIBER, nutrientName: "Fiber", nutrientNumber: "291", unitName: "G", value: 6 },
					{ nutrientId: NUTRIENT_IDS.SUGAR, nutrientName: "Sugar", nutrientNumber: "269", unitName: "G", value: 20 },
					{ nutrientId: NUTRIENT_IDS.PROTEIN, nutrientName: "Protein", nutrientNumber: "203", unitName: "G", value: 10 },
					{ nutrientId: NUTRIENT_IDS.SODIUM, nutrientName: "Sodium", nutrientNumber: "307", unitName: "MG", value: 600 },
					{ nutrientId: NUTRIENT_IDS.VITAMIN_C, nutrientName: "Vitamin C", nutrientNumber: "401", unitName: "MG", value: 20 },
				],
			},
			"4006381333931",
		);

		expect(draft?.nutrition).toEqual({
			calories: 200,
			fat: 6,
			carbs: 25,
			fiber: 3,
			sugar: 10,
			protein: 5,
		});
		expect(draft?.volumeEquivalent).toEqual({ quantity: 2, unit: "tbsp" });
		expect(draft?.additionalNutrients).toEqual([
			expect.objectContaining({ nutrientId: NUTRIENT_IDS.SODIUM, value: 300 }),
			expect.objectContaining({ nutrientId: NUTRIENT_IDS.VITAMIN_C, value: 10 }),
		]);
		expect(draft?.reportedNutrientIds).toContain(NUTRIENT_IDS.VITAMIN_C);
		expect(draft?.ingredientList).toEqual(["Corn", "sunflower oil", "salt"]);
		expect(draft?.allergens).toEqual(["corn"]);
	});

	it("marks approved catalog records as shared products", () => {
		const draft = mapSharedCatalogFood(
			{
				fdcId: -10,
				description: "Community cereal",
				barcode: "04006381333931",
				sharedProductId: "product-id",
				foodNutrients: [],
			},
			"4006381333931",
		);

		expect(draft).toMatchObject({
			source: "shared-catalog",
			sourceLabel: "Smoothie Mixer verified catalog",
			sourceReference: "product-id",
		});
	});
});
