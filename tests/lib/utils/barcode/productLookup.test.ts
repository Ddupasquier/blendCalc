import { describe, expect, it } from "vitest";
import {
	mapFdcBarcodeFood,
	mapOpenFoodFactsProduct,
} from "$lib/utils/barcode/productLookup";
import { NUTRIENT_IDS } from "$lib/utils/food/types";

describe("barcode product mapping", () => {
	it("converts Open Food Facts per-100g values to the label serving", () => {
		const draft = mapOpenFoodFactsProduct(
			{
				product_name: "Test cereal",
				brands: "Example Brand",
				serving_size: "30 g",
				serving_quantity: 30,
				nutriments: {
					"energy-kcal_100g": 500,
					fat_100g: 10,
					carbohydrates_100g: 60,
					fiber_100g: 8,
					sugars_100g: 20,
					proteins_100g: 12,
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
	});

	it("converts USDA per-100g branded values to the serving", () => {
		const draft = mapFdcBarcodeFood(
			{
				fdcId: 123,
				description: "Test snack",
				brandOwner: "Example Brand",
				servingSize: 50,
				servingSizeUnit: "g",
				householdServingFullText: "1 package",
				foodNutrients: [
					{ nutrientId: NUTRIENT_IDS.CALORIES, nutrientName: "Energy", nutrientNumber: "208", unitName: "KCAL", value: 400 },
					{ nutrientId: NUTRIENT_IDS.FAT, nutrientName: "Fat", nutrientNumber: "204", unitName: "G", value: 12 },
					{ nutrientId: NUTRIENT_IDS.CARBS, nutrientName: "Carbs", nutrientNumber: "205", unitName: "G", value: 50 },
					{ nutrientId: NUTRIENT_IDS.FIBER, nutrientName: "Fiber", nutrientNumber: "291", unitName: "G", value: 6 },
					{ nutrientId: NUTRIENT_IDS.SUGAR, nutrientName: "Sugar", nutrientNumber: "269", unitName: "G", value: 20 },
					{ nutrientId: NUTRIENT_IDS.PROTEIN, nutrientName: "Protein", nutrientNumber: "203", unitName: "G", value: 10 },
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
	});
});
