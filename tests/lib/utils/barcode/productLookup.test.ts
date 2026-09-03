import { describe, expect, it } from "vitest";
import {
	mapFdcBarcodeFood,
	mapOpenFoodFactsProduct,
	mapSharedCatalogFood,
} from "$lib/utils/barcode/barcodeProductMappers";
import { NUTRIENT_IDS } from "$lib/utils/food/types";
import { productReferenceCatalogFixture } from "../../../fixtures/referenceCatalogs";

describe("barcode product mapping", () => {
	it("retains every reviewed nutrient reported for UPC 00030000581728", () => {
		const draft = mapOpenFoodFactsProduct(
			{
				product_name: "Caramel Rice Crisps",
				brands: "Quaker",
				serving_size: "16 crisps (28 g)",
				serving_quantity: 28,
				nutrition_data_per: "serving",
				nutriments: {
					"energy-kcal_serving": 110,
					"energy-kcal_unit": "kcal",
					proteins_serving: 2,
					proteins_unit: "g",
					fat_serving: 1,
					fat_unit: "g",
					carbohydrates_serving: 24,
					carbohydrates_unit: "g",
					fiber_serving: 1,
					fiber_unit: "g",
					sugars_serving: 9,
					sugars_unit: "g",
					"added-sugars_serving": 9,
					"added-sugars_unit": "g",
					sodium_serving: 0.19,
					sodium_unit: "g",
					"saturated-fat_serving": 0,
					"saturated-fat_unit": "g",
					"trans-fat_serving": 0,
					"trans-fat_unit": "g",
					"polyunsaturated-fat_serving": 0,
					"polyunsaturated-fat_unit": "g",
					"monounsaturated-fat_serving": 0,
					"monounsaturated-fat_unit": "g",
					cholesterol_serving: 0,
					cholesterol_unit: "g",
					calcium_serving: 0.01,
					calcium_unit: "g",
					iron_serving: 0.0004,
					iron_unit: "g",
					potassium_serving: 0.06,
					potassium_unit: "g",
					"vitamin-d_serving": 0,
					"vitamin-d_unit": "g",
				},
			},
			"00030000581728",
			productReferenceCatalogFixture,
		);

		const valuesByNutrientId = new Map(
			draft?.nutrients.map((nutrient) => [nutrient.nutrientId, nutrient.value]),
		);
		expect(draft).toMatchObject({
			barcode: "00030000581728",
			servingLabel: "16 crisps (28 g)",
			servingWeightGrams: 28,
			serving: {
				label: "16 crisps (28 g)",
				gramWeight: 28,
				amount: 16,
				unitKey: "item",
				isHouseholdMeasure: true,
			},
		});
		expect(draft?.nutrients).toHaveLength(17);
		expect(valuesByNutrientId).toEqual(
			new Map([
				[1008, 110],
				[1004, 1],
				[1005, 24],
				[1079, 1],
				[2000, 9],
				[1235, 9],
				[1003, 2],
				[1258, 0],
				[1257, 0],
				[1293, 0],
				[1292, 0],
				[1253, 0],
				[1093, 190],
				[1087, 10],
				[1089, 0.4],
				[1092, 60],
				[1114, 0],
			]),
		);
		expect(draft?.reportedNutrientIds).toHaveLength(17);
		expect(
			draft?.nutrients.filter((nutrient) => nutrient.value === 0),
		).toHaveLength(6);
	});

	it("keeps unmapped Open Food Facts nutrient values as private review evidence", () => {
		const draft = mapOpenFoodFactsProduct(
			{
				product_name: "Future nutrient example",
				nutriments: {
					"energy-kcal_100g": 100,
					"future-nutrient_100g": 2,
					"future-nutrient_unit": "mg",
				},
			},
			"00000000000123",
			productReferenceCatalogFixture,
		);

		expect(draft?.nutrients).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.CALORIES }),
			]),
		);
		expect(draft?.nutrientSourceReview).toMatchObject([
			{
				nutrientName: "Future Nutrient",
				amount: 2,
				amountPer100g: 2,
				mappingStatus: "unmapped",
				source: "open-food-facts",
				sourceReference: "00000000000123",
				sourceNutrientKey: "future-nutrient",
			},
		]);
	});

	it("keeps Open Food Facts ABV separate from nutrient math", () => {
		const draft = mapOpenFoodFactsProduct(
			{
				product_name: "Example lager",
				nutriments: {
					alcohol_100g: 4.5,
					alcohol_unit: "% vol",
					"energy-kcal_100g": 42,
				},
			},
			"75041670",
			productReferenceCatalogFixture,
		);

		expect(draft?.alcoholByVolume).toEqual({
			percent: 4.5,
			valueStatus: "reported",
			basis: "volume-percent",
			sourceUnit: "% vol",
		});
		expect(draft?.fieldProvenance?.alcoholByVolume).toMatchObject({
			source: "open-food-facts",
			sourceReference: "00000075041670",
		});
		expect(draft?.nutrients).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ sourceNutrientKey: "alcohol" }),
			]),
		);
		expect(draft?.nutrientSourceReview).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ sourceNutrientKey: "alcohol" }),
			]),
		);
	});

	it("distinguishes reported zero ABV and rejects unknown alcohol units", () => {
		const alcoholFree = mapOpenFoodFactsProduct(
			{
				product_name: "Alcohol-free example",
				nutriments: { alcohol_value: 0, alcohol_unit: "% vol" },
			},
			"3080216055428",
			productReferenceCatalogFixture,
		);
		const wrongUnit = mapOpenFoodFactsProduct(
			{
				product_name: "Ambiguous example",
				nutriments: { alcohol_100g: 5, alcohol_unit: "g" },
			},
			"3080216052885",
			productReferenceCatalogFixture,
		);

		expect(alcoholFree?.alcoholByVolume).toMatchObject({
			percent: 0,
			valueStatus: "reported-zero",
		});
		expect(wrongUnit?.alcoholByVolume).toBeUndefined();
	});

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
			productReferenceCatalogFixture,
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
				expect.objectContaining({
					nutrientId: NUTRIENT_IDS.CALORIES,
					value: 150,
				}),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.FAT, value: 3 }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.CARBS, value: 18 }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.FIBER, value: 2.4 }),
				expect.objectContaining({ nutrientId: NUTRIENT_IDS.SUGAR, value: 6 }),
				expect.objectContaining({
					nutrientId: NUTRIENT_IDS.PROTEIN,
					value: 3.6,
				}),
			]),
		);
		expect(draft?.volumeEquivalent).toEqual({ quantity: 2, unit: "tbsp" });
		expect(draft?.nutrients).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					nutrientId: 1258,
					value: 1.2,
					unitName: "G",
				}),
				expect.objectContaining({
					nutrientId: NUTRIENT_IDS.SODIUM,
					value: 150,
					unitName: "MG",
				}),
				expect.objectContaining({
					nutrientId: NUTRIENT_IDS.CALCIUM,
					value: 36,
					unitName: "MG",
				}),
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
			productReferenceCatalogFixture,
		);

		expect(draft).toMatchObject({
			barcode: "00011110129505",
			name: "Kalamata Olives",
			servingLabel: "4 olives (15 g)",
			servingWeightGrams: 15,
		});
		expect(draft?.nutrients).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					nutrientId: NUTRIENT_IDS.CALORIES,
					value: 40,
				}),
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
		const driftedProductReferenceCatalog = {
			...productReferenceCatalogFixture,
			nutrientMappings: productReferenceCatalogFixture.nutrientMappings.map(
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
			driftedProductReferenceCatalog,
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
			productReferenceCatalogFixture,
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
			productReferenceCatalogFixture,
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

	it("preserves Open Food Facts less-than modifiers without treating limits as exact values", () => {
		const draft = mapOpenFoodFactsProduct(
			{
				product_name: "Threshold cereal",
				serving_size: "30 g",
				nutrition_data_per: "serving",
				nutriments: {
					fiber: 1,
					fiber_value: 1,
					fiber_unit: "g",
					fiber_modifier: "<",
					fiber_serving: 1,
					fiber_100g: 3.33,
				},
			},
			"4006381333931",
			productReferenceCatalogFixture,
		);

		expect(draft?.nutrients).not.toContainEqual(
			expect.objectContaining({ nutrientId: NUTRIENT_IDS.FIBER }),
		);
		expect(draft?.reportedNutrientIds).not.toContain(NUTRIENT_IDS.FIBER);
		expect(draft?.nutrientQualitativeFacts).toContainEqual(
			expect.objectContaining({
				nutrientId: NUTRIENT_IDS.FIBER,
				status: "below-reporting-threshold",
				maximumAmount: 1,
				measurementBasis: {
					kind: "serving",
					quantity: 1,
					unitKey: "serving",
					servingLabel: "30 g",
				},
				source: "open-food-facts",
			}),
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
			productReferenceCatalogFixture,
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
			productReferenceCatalogFixture,
		);

		expect(draft?.servingWeightGrams).toBeNull();
		expect(draft?.servingLabel).toBe("355 ml");
		expect(draft?.serving).toMatchObject({
			label: "355 ml",
			milliliterVolume: 355,
			amount: 355,
			unitKey: "ml",
		});
		expect(draft?.nutrients).toEqual([
			expect.objectContaining({
				value: 1,
				measurementBasis: { kind: "mass", quantity: 100, unitKey: "g" },
			}),
		]);
		expect(draft?.volumeEquivalent).toBeUndefined();
	});

	it("uses exact package volume when no package serving is reported", () => {
		const draft = mapOpenFoodFactsProduct(
			{
				product_name: "Mineral-enhanced drinking water",
				quantity: "500 mL",
				product_quantity: 500,
				product_quantity_unit: "ml",
				nutriments: {
					"energy-kcal_100g": 0,
					sodium_100g: 0.2,
				},
			},
			"096619756803",
			productReferenceCatalogFixture,
		);

		expect(draft?.hasSourceServing).toBe(true);
		expect(draft?.servingWeightGrams).toBeNull();
		expect(draft?.servingLabel).toBe("500 mL package");
		expect(draft?.serving).toEqual({
			label: "500 mL package",
			milliliterVolume: 500,
			amount: 500,
			unitKey: "ml",
			isPrimary: true,
			measureType: "Package amount",
			isHouseholdMeasure: false,
			sourceMeasureKey: "product_quantity",
			origin: "package-label",
			gramWeightMethod: "unknown",
			source: "open-food-facts",
			sourceReference: "00096619756803",
			confidence: "unknown",
		});
		expect(draft?.nutrients).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					measurementBasis: { kind: "mass", quantity: 100, unitKey: "g" },
				}),
			]),
		);
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
			productReferenceCatalogFixture,
		);

		expect(draft).toMatchObject({
			ingredients: "Cultured milk, honey, pectin",
			ingredientList: ["Cultured milk", "honey", "pectin"],
			allergens: ["milk"],
			traces: ["tree nuts"],
			dietaryTags: ["gluten free"],
			categories: [
				"milk and yogurt",
				"dairy desserts",
				"dairy products",
				"yogurts",
			],
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
			productReferenceCatalogFixture,
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

	it("keeps derived ingredient declarations separate from provider allergen fields", () => {
		const draft = mapOpenFoodFactsProduct(
			{
				product_name: "English declaration",
				lang: "fr",
				ingredients_text_en:
					"Rice flour, cocoa. Contains milk. May contain peanuts.",
				nutriments: { "energy-kcal_100g": 100 },
			},
			"049000042566",
			productReferenceCatalogFixture,
		);

		expect(draft).toMatchObject({
			allergens: [],
			traces: [],
			ingredientAnalysis: {
				allergenDeclarationAnalysis: {
					sourceField: "ingredients_text_en",
					languageCode: "en",
					languageStatus: "supported",
					extractionStatus: "parsed",
					contains: ["milk"],
					mayContain: ["peanuts"],
				},
			},
			precautionaryStatements: [
				{
					type: "may_contain",
					text: "May contain peanuts",
					allergens: ["peanuts"],
					languageCode: "en",
					sourceField: "ingredients_text_en",
				},
			],
			fieldProvenance: {
				ingredientAnalysis: { source: "open-food-facts" },
			},
		});
		expect(draft?.fieldProvenance?.allergens).toBeUndefined();
		expect(draft?.fieldProvenance?.traces).toBeUndefined();
	});

	it("records unreviewed Open Food Facts declaration languages without parsing them", () => {
		const draft = mapOpenFoodFactsProduct(
			{
				product_name: "French declaration",
				lang: "fr",
				ingredients_text: "Riz, cacao. Contient du lait.",
				nutriments: { "energy-kcal_100g": 100 },
			},
			"049000042566",
			productReferenceCatalogFixture,
		);

		expect(
			draft?.ingredientAnalysis?.allergenDeclarationAnalysis,
		).toMatchObject({
			sourceField: "ingredients_text",
			languageCode: "fr",
			languageStatus: "unsupported",
			extractionStatus: "skipped",
			contains: [],
			mayContain: [],
		});
		expect(draft?.allergens).toEqual([]);
		expect(draft?.traces).toEqual([]);
	});

	it("keeps Open Food Facts package image metadata with attribution", () => {
		const draft = mapOpenFoodFactsProduct(
			{
				product_name: "Test jelly",
				brands: "Example Brand",
				image_front_url:
					"https://images.openfoodfacts.org/images/products/000/211/304/62506/front_en.3.400.jpg",
				image_front_small_url:
					"https://images.openfoodfacts.org/images/products/000/211/304/62506/front_en.3.200.jpg",
				nutriments: { "energy-kcal_100g": 50 },
			},
			"00021130462506",
			productReferenceCatalogFixture,
		);

		expect(draft?.image).toMatchObject({
			source: "open-food-facts",
			sourceReference: "00021130462506",
			role: "front",
			imageUrl:
				"https://images.openfoodfacts.org/images/products/000/211/304/62506/front_en.3.400.jpg",
			thumbnailUrl:
				"https://images.openfoodfacts.org/images/products/000/211/304/62506/front_en.3.200.jpg",
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
			productReferenceCatalogFixture,
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
					{
						nutrientId: NUTRIENT_IDS.CALORIES,
						nutrientName: "Energy",
						nutrientNumber: "208",
						unitName: "KCAL",
						value: 400,
					},
					{
						nutrientId: NUTRIENT_IDS.FAT,
						nutrientName: "Fat",
						nutrientNumber: "204",
						unitName: "G",
						value: 12,
					},
					{
						nutrientId: NUTRIENT_IDS.CARBS,
						nutrientName: "Carbs",
						nutrientNumber: "205",
						unitName: "G",
						value: 50,
					},
					{
						nutrientId: NUTRIENT_IDS.FIBER,
						nutrientName: "Fiber",
						nutrientNumber: "291",
						unitName: "G",
						value: 6,
					},
					{
						nutrientId: NUTRIENT_IDS.SUGAR,
						nutrientName: "Sugar",
						nutrientNumber: "269",
						unitName: "G",
						value: 20,
					},
					{
						nutrientId: NUTRIENT_IDS.PROTEIN,
						nutrientName: "Protein",
						nutrientNumber: "203",
						unitName: "G",
						value: 10,
					},
					{
						nutrientId: NUTRIENT_IDS.SODIUM,
						nutrientName: "Sodium",
						nutrientNumber: "307",
						unitName: "MG",
						value: 600,
					},
					{
						nutrientId: NUTRIENT_IDS.VITAMIN_C,
						nutrientName: "Vitamin C",
						nutrientNumber: "401",
						unitName: "MG",
						value: 20,
					},
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
			productReferenceCatalogFixture,
		);

		expect(draft?.nutrients).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					nutrientId: NUTRIENT_IDS.CALORIES,
					value: 200,
				}),
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
				expect.objectContaining({
					nutrientId: NUTRIENT_IDS.SODIUM,
					value: 300,
				}),
				expect.objectContaining({
					nutrientId: NUTRIENT_IDS.VITAMIN_C,
					value: 10,
				}),
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
			productReferenceCatalogFixture,
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
			productReferenceCatalogFixture,
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
			productReferenceCatalogFixture,
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
			productReferenceCatalogFixture,
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

	it("keeps derived USDA ingredient declarations separate from reported fields", () => {
		const draft = mapFdcBarcodeFood(
			{
				fdcId: 124,
				description: "Test almond drink",
				ingredients:
					"Almondmilk, calcium carbonate. Contains Almonds. May contain soy.",
				foodNutrients: [],
			},
			"4006381333931",
			productReferenceCatalogFixture,
		);

		expect(draft).toMatchObject({
			allergens: [],
			traces: [],
			ingredientAnalysis: {
				allergenDeclarationAnalysis: {
					languageStatus: "unknown",
					extractionStatus: "parsed",
					contains: ["Almonds"],
					mayContain: ["soy"],
					statements: [
						{
							type: "contains",
							text: "Contains Almonds",
							allergens: ["Almonds"],
						},
						{
							type: "may_contain",
							text: "May contain soy",
							allergens: ["soy"],
						},
					],
				},
			},
			precautionaryStatements: [
				{
					type: "may_contain",
					text: "May contain soy",
					allergens: ["soy"],
					sourceField: "ingredients",
				},
			],
			fieldProvenance: {
				ingredientAnalysis: { source: "usda", confidence: "unknown" },
			},
		});
		expect(draft?.fieldProvenance?.allergens).toBeUndefined();
		expect(draft?.fieldProvenance?.traces).toBeUndefined();
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
			productReferenceCatalogFixture,
		);

		expect(draft?.allergens).toEqual([]);
		expect(draft?.traces).toEqual([]);
		expect(draft?.fieldProvenance?.allergens).toBeUndefined();
		expect(draft?.fieldProvenance?.traces).toBeUndefined();
	});
});
