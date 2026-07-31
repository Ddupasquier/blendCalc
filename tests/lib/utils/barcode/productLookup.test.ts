import { describe, expect, it } from "vitest";
import {
	mapFdcBarcodeFood,
	mapOpenFoodFactsProduct,
	mapSharedCatalogFood,
} from "$lib/utils/barcode/barcodeProductMappers";
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
			name: "Test Cereal",
			nameProvenance: "source",
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

	it("autofills every nutrient reported for barcode 00011110129505", () => {
		const draft = mapOpenFoodFactsProduct(
			{
				product_name: "Kalamata olives",
				brands: "Kroger",
				serving_size: "4 olives (15 g)",
				serving_quantity: 15,
				nutriments: {
					"energy-kcal_serving": 40,
					"energy-kcal_unit": "kcal",
					fat_serving: 4,
					fat_unit: "g",
					"saturated-fat_serving": 0.5,
					"saturated-fat_unit": "g",
					carbohydrates_serving: 1,
					carbohydrates_unit: "g",
					fiber_serving: 1,
					fiber_unit: "g",
					proteins_serving: 0,
					proteins_unit: "g",
					sodium_serving: 0.25,
					sodium_unit: "g",
				},
			},
			"00011110129505",
			productReferenceDataFixture,
		);

		expect(draft).toMatchObject({
			barcode: "00011110129505",
			name: "Kalamata Olives",
			servingLabel: "4 olives (15 g)",
			servingWeightGrams: 15,
		});
		expect(draft?.nutrients).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.CALORIES, value: 40 }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.FAT, value: 4 }),
				expect.objectContaining({ nutrientId: 1258, value: 0.5 }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.CARBS, value: 1 }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.FIBER, value: 1 }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.PROTEIN, value: 0 }),
				expect.objectContaining({
					nutrientId: NUTRIENT_IDS.SODIUM,
					unitName: "MG",
					value: 250,
				}),
			]),
		);
		expect(draft?.nutrients).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ nutrientId: 1257 }),
				expect.objectContaining({ nutrientId: 1292 }),
				expect.objectContaining({ nutrientId: 1293 }),
				expect.objectContaining({ nutrientId: 1253 }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.SUGAR }),
			]),
		);
	});

	it("canonicalizes a drifted Open Food Facts total-fat mapping", () => {
		const driftedReferenceData = {
			...productReferenceDataFixture,
			nutrientMappings: productReferenceDataFixture.nutrientMappings.map(
				(mapping) =>
					mapping.sourceNutrientKey === "fat"
						? {
								...mapping,
								nutrientId: 1085,
								nutrientName: "Total fat (NLEA)",
								nutrientNumber: "298",
							}
						: mapping,
			),
		};
		const draft = mapOpenFoodFactsProduct(
			{
				product_name: "Test eggs",
				serving_size: "50 g",
				nutriments: {
					fat_serving: 5,
					fat_unit: "g",
				},
			},
			"00011110129505",
			driftedReferenceData,
		);

		expect(draft?.nutrients).toContainEqual(
			expect.objectContaining({
				nutrientId: NUTRIENT_IDS.FAT,
				nutrientName: "Total lipid (fat)",
				nutrientNumber: "204",
				value: 5,
			}),
		);
		expect(draft?.nutrients).not.toContainEqual(
			expect.objectContaining({ nutrientId: 1085 }),
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

	it("does not convert missing or negative Open Food Facts values to zero", () => {
		const draft = mapOpenFoodFactsProduct(
			{
				product_name: "Missing macro drink",
				serving_size: "100 g",
				nutriments: {
					"energy-kcal_100g": null as unknown as number,
					fat_100g: -1,
					proteins_100g: 0,
				},
			},
			"4006381333931",
			productReferenceDataFixture,
		);

		expect(draft?.nutrients).toEqual([
			expect.objectContaining({
				nutrientId: NUTRIENT_IDS.PROTEIN,
				value: 0,
				confidence: "unknown",
			}),
		]);
		expect(draft?.reportedNutrientIds).toEqual([NUTRIENT_IDS.PROTEIN]);
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
				fieldProvenance: {
					ingredients: { source: "open-food-facts" },
					allergens: { source: "open-food-facts" },
					traces: { source: "open-food-facts" },
					dietaryTags: { source: "open-food-facts" },
					labels: { source: "open-food-facts" },
				},
			});
	});

	it("preserves structured Open Food Facts package and quality metadata", () => {
		const draft = mapOpenFoodFactsProduct(
			{
				product_name: "Structured product",
				ingredients_text_en: "Shrimp, wheat flour, salt",
				ingredients: [
					{
						id: "en:shrimp",
						text: "Shrimp",
						percent_estimate: 45,
					},
					{
						id: "en:wheat-flour",
						text: "Wheat flour",
						ingredients: [{ id: "en:wheat", text: "Wheat" }],
					},
				],
				ingredients_tags: ["en:shrimp", "en:wheat-flour"],
				ingredients_analysis_tags: ["en:non-vegan"],
				ingredients_percent_estimate: 81,
				ingredients_percent_known: 75,
				traces_from_ingredients: "en:soy",
				allergens_hierarchy: ["en:crustaceans", "en:wheat"],
				traces_hierarchy: ["en:sesame-seeds"],
				additives_tags: ["en:e330"],
				quantity: "340 g",
				product_quantity: 340,
				product_quantity_unit: "g",
				lang: "en",
				languages_tags: ["en:english"],
				countries: "United States, Canada",
				countries_tags: ["en:united-states", "en:canada"],
				rev: 12,
				schema_version: 999,
				created_t: 1_700_000_000,
				last_modified_t: 1_710_000_000,
				completeness: 0.92,
				data_quality_warnings_tags: ["en:ingredients-unknown-score-above-0"],
				tags_sources: { allergens: ["ingredients", "packaging"] },
				nutriments: { "energy-kcal_100g": 100 },
			},
			"049000042566",
			productReferenceDataFixture,
		);

		expect(draft).toMatchObject({
			foodIdentityType: "packaged",
			ingredientList: ["Shrimp", "wheat flour", "salt", "Wheat"],
			structuredIngredients: [
				{
					id: "shrimp",
					text: "Shrimp",
					percentEstimate: 45,
				},
				{
					id: "wheat flour",
					text: "Wheat flour",
					ingredients: [{ id: "wheat", text: "Wheat" }],
				},
			],
			ingredientAnalysis: {
				ingredientTags: ["shrimp", "wheat flour"],
				analysisTags: ["non vegan"],
				derivedTraceTags: ["soy"],
				percentEstimate: 81,
				percentKnown: 75,
			},
			additives: ["e330"],
			allergens: ["crustaceans", "wheat"],
			traces: ["sesame seeds"],
			packageQuantity: {
				label: "340 g",
				amount: 340,
				unit: "g",
			},
			sourceMetadata: {
				language: "en",
				languages: ["english"],
				marketCountries: ["United States", "Canada"],
				revision: 12,
				schemaVersion: 999,
				completeness: 0.92,
				qualityWarningTags: ["ingredients unknown score above 0"],
				tagSources: { allergens: ["ingredients", "packaging"] },
			},
			fieldProvenance: {
				structuredIngredients: { source: "open-food-facts" },
				ingredientAnalysis: { source: "open-food-facts" },
				additives: { source: "open-food-facts" },
				package: { source: "open-food-facts" },
				sourceMetadata: { source: "open-food-facts" },
			},
		});
		expect(draft?.sourceModifiedDate).toBe("2024-03-09T16:00:00.000Z");
		expect(draft?.traces).not.toContain("soy");
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
		expect(draft?.fieldProvenance?.image).toMatchObject({
			source: "open-food-facts",
			sourceReference: "00021130462506",
			confidence: "imported",
		});
	});

	it("keeps a useful Open Food Facts supplement when nutrition is missing", () => {
		const draft = mapOpenFoodFactsProduct(
			{
				product_name: "Test sauce",
				categories_tags: ["en:pasta-sauces"],
				image_front_url: "https://images.openfoodfacts.org/product.jpg",
			},
			"00021130493609",
			productReferenceDataFixture,
		);

		expect(draft).toMatchObject({
			barcode: "00021130493609",
			name: "Test Sauce",
			nutrients: [],
			reportedNutrientIds: [],
			categories: ["pasta sauces"],
			image: {
				source: "open-food-facts",
				imageUrl: "https://images.openfoodfacts.org/product.jpg",
			},
			fieldProvenance: {
				image: { source: "open-food-facts" },
				categories: { source: "open-food-facts" },
			},
		});
		expect(draft?.fieldProvenance?.nutrition).toBeUndefined();
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
				reportedNutrientIds: [
					NUTRIENT_IDS.CALORIES,
					NUTRIENT_IDS.FAT,
					NUTRIENT_IDS.CARBS,
					NUTRIENT_IDS.FIBER,
					NUTRIENT_IDS.SUGAR,
					NUTRIENT_IDS.PROTEIN,
					NUTRIENT_IDS.SODIUM,
					NUTRIENT_IDS.VITAMIN_C,
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
			fieldProvenance: {
					nutrition: { source: "usda", confidence: "unknown" },
					categories: { source: "usda", confidence: "unknown" },
					serving: { source: "usda", confidence: "unknown" },
					ingredients: { source: "usda", confidence: "unknown" },
					allergens: { source: "usda", confidence: "unknown" },
				},
			});
	});

	it("uses the database-derived USDA GRM serving alias", () => {
		const draft = mapFdcBarcodeFood(
			{
				fdcId: 126,
				description: "Test spread",
				servingSize: 32,
				servingSizeUnit: "GRM",
				householdServingFullText: "2 Tbsp",
				foodNutrients: [
					{
						nutrientId: NUTRIENT_IDS.PROTEIN,
						nutrientName: "Protein",
						nutrientNumber: "203",
						unitName: "G",
						value: 25,
					},
				],
			},
			"4006381333931",
			productReferenceDataFixture,
		);

		expect(draft).toMatchObject({
			servingLabel: "2 Tbsp",
			servingWeightGrams: 32,
			hasSourceServing: true,
		});
		expect(draft?.nutrients).toContainEqual(
			expect.objectContaining({
				nutrientId: NUTRIENT_IDS.PROTEIN,
				value: 8,
			}),
		);
	});

	it("canonicalizes alternate USDA nutrient IDs before manual-entry autofill", () => {
		const draft = mapFdcBarcodeFood(
			{
				fdcId: 127,
				description: "Large eggs",
				servingSize: 50,
				servingSizeUnit: "g",
				householdServingFullText: "1 egg",
				foodNutrients: [
					{
						nutrientId: 1085,
						nutrientName: "Total fat (NLEA)",
						nutrientNumber: "298",
						unitName: "G",
						value: 10,
						valueOrigin: "reported",
						source: "usda",
					},
					{
						nutrientId: 1063,
						nutrientName: "Sugars, Total",
						nutrientNumber: "269.3",
						unitName: "G",
						value: 2,
						valueOrigin: "reported",
						source: "usda",
					},
				],
				reportedNutrientIds: [1085, 1063],
			},
			"00021130462506",
			productReferenceDataFixture,
		);

		expect(draft?.nutrients).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					nutrientId: NUTRIENT_IDS.FAT,
					nutrientName: "Total lipid (fat)",
					value: 5,
				}),
				expect.objectContaining({
					nutrientId: NUTRIENT_IDS.SUGAR,
					nutrientName: "Total Sugars",
					value: 1,
				}),
			]),
		);
		expect(draft?.reportedNutrientIds).toEqual(
			expect.arrayContaining([NUTRIENT_IDS.FAT, NUTRIENT_IDS.SUGAR]),
		);
	});

	it("keeps an exact canonical nutrient when the provider also reports its alias", () => {
		const draft = mapFdcBarcodeFood(
			{
				fdcId: 128,
				description: "Egg product",
				servingSize: 50,
				servingSizeUnit: "g",
				householdServingFullText: "1 egg",
				foodNutrients: [
					{
						nutrientId: 1085,
						nutrientName: "Total fat (NLEA)",
						nutrientNumber: "298",
						unitName: "G",
						value: 12,
						valueOrigin: "reported",
						source: "usda",
					},
					{
						nutrientId: NUTRIENT_IDS.FAT,
						nutrientName: "Total lipid (fat)",
						nutrientNumber: "204",
						unitName: "G",
						value: 10,
						valueOrigin: "reported",
						source: "usda",
					},
				],
			},
			"00021130462506",
			productReferenceDataFixture,
		);

		expect(
			draft?.nutrients.filter(
				(nutrient) => nutrient.nutrientId === NUTRIENT_IDS.FAT,
			),
		).toEqual([
			expect.objectContaining({
				nutrientName: "Total lipid (fat)",
				value: 5,
			}),
		]);
	});

	it("keeps approved catalog records without inventing missing field lineage", () => {
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
		expect(draft?.fieldProvenance?.categories).toBeUndefined();
	});

	it("keeps explicit USDA ingredient-label allergen declarations", () => {
		const draft = mapFdcBarcodeFood(
			{
				fdcId: 124,
				description: "Test almond drink",
				ingredients:
					"Almondmilk, calcium carbonate. Contains Almonds. May contain soy.",
				foodNutrients: [],
			},
			"4006381333931",
			productReferenceDataFixture,
		);

		expect(draft).toMatchObject({
			allergens: ["Almonds"],
			traces: ["soy"],
			fieldProvenance: {
				allergens: { source: "usda", confidence: "unknown" },
				traces: { source: "usda", confidence: "unknown" },
			},
		});
	});

	it("does not infer USDA allergens from ordinary ingredient names", () => {
		const draft = mapFdcBarcodeFood(
			{
				fdcId: 125,
				description: "Test sauce",
				ingredients: "Soybean paste, wheat extract, milk powder",
				foodNutrients: [],
			},
			"4006381333931",
			productReferenceDataFixture,
		);

		expect(draft?.allergens).toEqual([]);
		expect(draft?.traces).toEqual([]);
		expect(draft?.fieldProvenance?.allergens).toBeUndefined();
		expect(draft?.fieldProvenance?.traces).toBeUndefined();
	});
});
