import { describe, expect, it } from "vitest";
import {
	mapFdcBarcodeFood,
	mapOpenFoodFactsProduct,
	mapSharedCatalogFood,
} from "$lib/utils/barcode/productLookup";
import { NUTRIENT_IDS } from "$lib/utils/food/types";
import { productReferenceDataFixture } from "../../../fixtures/referenceData";

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
			productReferenceDataFixture,
		);

		expect(draft).toMatchObject({
			barcode: "04006381333931",
			name: "Test cereal",
			brandOwner: "Example Brand",
			servingWeightGrams: 30,
		});
		expect(draft?.nutrients).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.CALORIES, value: 150 }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.FAT, value: 3 }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.CARBS, value: 18 }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.FIBER, value: 2.4 }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.SUGAR, value: 6 }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.PROTEIN, value: 3.6 }),
			]),
		);
		expect(draft?.volumeEquivalent).toEqual({ quantity: 2, unit: "tbsp" });
		expect(draft?.nutrients).toEqual(
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

	it("keeps Open Food Facts core nutrients when the source reports zero", () => {
		const draft = mapOpenFoodFactsProduct(
			{
				product_name: "Zero macro drink",
				serving_size: "100 g",
				nutriments: {
					"energy-kcal_100g": 50,
					fat_100g: 0,
					carbohydrates_100g: 13,
					sugars_100g: 0,
					proteins_100g: 0,
				},
			},
			"4006381333931",
			productReferenceDataFixture,
		);

		expect(draft?.nutrients).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.FAT, value: 0 }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.SUGAR, value: 0 }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.PROTEIN, value: 0 }),
			]),
		);
		expect(draft?.reportedNutrientIds).toEqual(
			expect.arrayContaining([
				NUTRIENT_IDS.FAT,
				NUTRIENT_IDS.SUGAR,
				NUTRIENT_IDS.PROTEIN,
			]),
		);
	});

	it("uses the DB-provided conversion for source-specific nutrient units", () => {
		const draft = mapOpenFoodFactsProduct(
			{
				product_name: "Vitamin drink",
				serving_size: "100 g",
				nutriments: {
					"energy-kcal_100g": 10,
					"vitamin-d_100g": 40,
					"vitamin-d_unit": "IU",
				},
			},
			"4006381333931",
			productReferenceDataFixture,
		);

		expect(draft?.nutrients).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ nutrientId: 1114, unitName: "UG", value: 1 }),
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
			productReferenceDataFixture,
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
				categories_hierarchy: ["en:dairy-products", "en:yogurts"],
				food_groups: "en:milk-and-yogurt",
				food_groups_tags: ["en:dairy-desserts"],
				nutriments: { "energy-kcal_100g": 100 },
			},
			"049000042566",
			productReferenceDataFixture,
		);

		expect(draft).toMatchObject({
			ingredients: "Cultured milk, honey, pectin",
			ingredientList: ["Cultured milk", "honey", "pectin"],
			allergens: ["milk"],
			traces: ["tree nuts"],
			dietaryTags: ["gluten free"],
			categories: ["milk and yogurt", "dairy desserts", "dairy products", "yogurts"],
		});
	});

	it("keeps Open Food Facts package image metadata with attribution", () => {
		const draft = mapOpenFoodFactsProduct(
			{
				product_name: "Test jelly",
				brands: "Example Brand",
				image_front_url: "https://images.openfoodfacts.org/images/products/000/211/304/62506/front_en.3.400.jpg",
				image_front_small_url: "https://images.openfoodfacts.org/images/products/000/211/304/62506/front_en.3.200.jpg",
				nutriments: { "energy-kcal_100g": 50 },
			},
			"00021130462506",
			productReferenceDataFixture,
		);

		expect(draft?.image).toMatchObject({
			source: "open-food-facts",
			sourceReference: "00021130462506",
			role: "front",
			imageUrl: "https://images.openfoodfacts.org/images/products/000/211/304/62506/front_en.3.400.jpg",
			thumbnailUrl: "https://images.openfoodfacts.org/images/products/000/211/304/62506/front_en.3.200.jpg",
			licenseName: "Creative Commons Attribution-ShareAlike",
			licenseUrl: "https://world.openfoodfacts.org/terms-of-use",
			attributionText: "Open Food Facts contributors",
			confidence: "imported",
		});
		expect(draft?.image?.fetchedAt).toBeTruthy();
	});

	it("converts USDA per-100g branded values to the serving", () => {
		const draft = mapFdcBarcodeFood(
			{
				fdcId: 123,
				description: "Test snack",
				brandOwner: "Example Brand",
				foodCategory: "Chips, Pretzels & Snacks",
				dataType: "Branded",
				publishedDate: "2024-05-01",
				modifiedDate: "2024-04-15",
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
			productReferenceDataFixture,
		);

		expect(draft?.nutrients).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.CALORIES, value: 200 }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.FAT, value: 6 }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.CARBS, value: 25 }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.FIBER, value: 3 }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.SUGAR, value: 10 }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.PROTEIN, value: 5 }),
			]),
		);
		expect(draft?.volumeEquivalent).toEqual({ quantity: 2, unit: "tbsp" });
		expect(draft?.nutrients).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.SODIUM, value: 300 }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.VITAMIN_C, value: 10 }),
			]),
		);
		expect(draft?.reportedNutrientIds).toContain(NUTRIENT_IDS.VITAMIN_C);
		expect(draft?.ingredientList).toEqual(["Corn", "sunflower oil", "salt"]);
		expect(draft?.allergens).toEqual(["corn"]);
		expect(draft?.categories).toContain("Chips, Pretzels & Snacks");
		expect(draft).toMatchObject({
			sourceKey: "usda",
			sourceDataType: "Branded",
			sourcePublishedDate: "2024-05-01",
			sourceModifiedDate: "2024-04-15",
		});
	});

	it("marks approved catalog records as shared products", () => {
		const draft = mapSharedCatalogFood(
			{
				fdcId: -10,
				description: "Community cereal",
				barcode: "04006381333931",
				sharedProductId: "product-id",
				categoryOptionId: "breakfast-cereals",
				foodCategory: "Breakfast Cereals",
				categories: ["Breakfast Cereals", "Cereals"],
				foodNutrients: [],
			},
			"4006381333931",
			productReferenceDataFixture,
		);

			expect(draft).toMatchObject({
			source: "shared-catalog",
			sourceLabel: "blendCalc verified catalog",
			sourceReference: "product-id",
			resolvedCategory: "Breakfast Cereals",
			categoryResolution: {
				categoryOptionId: "breakfast-cereals",
				label: "Breakfast Cereals",
			},
		});
	});
});
