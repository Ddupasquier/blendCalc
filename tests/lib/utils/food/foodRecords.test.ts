import { describe, expect, it } from "vitest";
import {
	normalizeFoodForStorage,
	normalizeSourceManagedFoodForStorage,
	getCanonicalFoodDescription,
} from "$lib/utils/food/records/foodRecords";
import type { FoodItem } from "$lib/utils/food/types";

describe("compact food records", () => {
	it("keeps field-level source tracking in saved food snapshots", () => {
		const food: FoodItem = {
			fdcId: 2658692,
			description: "Roasted Onion & Garlic Pasta Sauce",
			foodNutrients: [],
			fieldProvenance: {
				nutrition: {
					source: "usda",
					sourceReference: "2658692",
					confidence: "source-verified",
				},
				image: {
					source: "open-food-facts",
					sourceReference: "00021130493609",
					confidence: "imported",
				},
				serving: {
					source: "open-food-facts",
					sourceReference: "00021130493609",
					confidence: "imported",
				},
			},
			sourceEnrichmentDecisions: [
				{
					field: "serving",
					reason: "missing-current-value",
					selectedSource: {
						source: "open-food-facts",
						sourceReference: "00021130493609",
						confidence: "imported",
						observedAt: "2026-08-01T00:00:00.000Z",
					},
				},
			],
		};

		const storedFood = normalizeFoodForStorage(food);
		expect(storedFood.fieldProvenance).toEqual(food.fieldProvenance);
		expect(storedFood.sourceEnrichmentDecisions).toEqual(
			food.sourceEnrichmentDecisions,
		);
		expect(storedFood.sourceEnrichmentDecisions?.[0].selectedSource).not.toBe(
			food.sourceEnrichmentDecisions?.[0].selectedSource,
		);
	});

	it("keeps safe barcode capture provenance in saved food snapshots", () => {
		const food: FoodItem = {
			fdcId: -1,
			description: "GS1 Test Product",
			foodNutrients: [],
			barcode: "09506000151519",
			barcodeProvenance: {
				captureMethod: "gs1-digital-link",
				sourceReference: "https://id.gs1.org/01/09506000151519",
				format: "QR_CODE",
			},
		};

		expect(normalizeFoodForStorage(food).barcodeProvenance).toEqual(
			food.barcodeProvenance,
		);
	});

	it("keeps deep-dive source and category metadata in saved food snapshots", () => {
		const secondAttribution = {
			datasetKey: "cofid-2021",
			datasetName: "CoFID 2021",
			datasetVersion: "2021",
			sourceName: "UK Government",
			sourceUrl: "https://example.com/cofid",
			licenseName: "Open Government Licence",
			licenseUrl: "https://example.com/ogl",
			attributionText: "Contains licensed UK data.",
		};
		const food: FoodItem = {
			fdcId: 101,
			description: "Blueberries",
			foodNutrients: [],
			brandedFoodCategory: "Fresh fruit",
			sourceAttribution: {
				datasetKey: "cnf-2026",
				datasetName: "Canadian Nutrient File 2026",
				datasetVersion: "2026",
				sourceName: "Health Canada",
				sourceUrl: "https://example.com/cnf",
				licenseName: "Open Government Licence – Canada",
				licenseUrl: "https://example.com/license",
				attributionText: "Contains licensed Canadian data.",
			},
			sourceAttributions: [secondAttribution],
		};

		expect(normalizeFoodForStorage(food)).toMatchObject({
			brandedFoodCategory: "Fresh fruit",
			sourceAttribution: food.sourceAttribution,
			sourceAttributions: [secondAttribution],
		});
		expect(normalizeFoodForStorage(food).sourceAttribution).not.toBe(
			food.sourceAttribution,
		);
		expect(normalizeFoodForStorage(food).sourceAttributions?.[0]).not.toBe(
			secondAttribution,
		);
	});

	it("does not assume nutrients were reported when status is absent", () => {
		const food: FoodItem = {
			fdcId: 2,
			description: "Unknown nutrient status",
			foodNutrients: [
				{
					nutrientId: 1004,
					nutrientName: "Total Fat",
					nutrientNumber: "204",
					unitName: "G",
					value: 0,
				},
			],
		};

		expect(normalizeFoodForStorage(food).reportedNutrientIds).toEqual([]);
	});

	it("normalizes every catalog-bound name before persistence", () => {
		const food: FoodItem = {
			fdcId: -3,
			description: "ROASTED ONION AND GARLIC PASTA SAUCE",
			nameProvenance: "user",
			foodNutrients: [],
		};

		expect(normalizeSourceManagedFoodForStorage(food)).toMatchObject({
			description: "Roasted Onion & Garlic Pasta Sauce",
			nameProvenance: "source",
		});
	});

	it("normalizes externally sourced ingredients at the storage boundary", () => {
		const storedFood = normalizeFoodForStorage({
			fdcId: 42,
			description: "Provider food",
			foodNutrients: [],
			ingredients: "DRY ROASTED _PEANUTS_, SALT. MAY CONTAIN SOY.",
			fieldProvenance: {
				ingredients: { source: "open-food-facts" },
			},
			sourceMetadata: { language: "en" },
		});

		expect(storedFood).toMatchObject({
			ingredients: "Dry roasted peanuts, salt",
			ingredientList: ["Dry roasted peanuts", "salt"],
			ingredientAnalysis: {
				normalization: {
					method: "external-ingredient-statement",
					version: 1,
				},
			},
			precautionaryStatements: [
				{
					type: "may_contain",
					text: "MAY CONTAIN SOY",
					allergens: ["Soy"],
					sourceField: "ingredients",
				},
			],
		});
	});

	it("does not rewrite user-authored ingredient text", () => {
		const ingredients = "My MIX: _Peanuts_ + salt";
		const storedFood = normalizeFoodForStorage({
			fdcId: -42,
			description: "Private recipe",
			foodNutrients: [],
			ingredients,
			fieldProvenance: {
				ingredients: { source: "user-label" },
			},
		});

		expect(storedFood.ingredients).toBe(ingredients);
		expect(storedFood.ingredientAnalysis).toBeUndefined();
	});

	it("preserves the canonical name separately from a personal list name", () => {
		const food: FoodItem = {
			fdcId: 3,
			description: "My Breakfast Spinach",
			canonicalDescription: "Spinach, Raw",
			nameProvenance: "user",
			foodNutrients: [],
		};

		expect(normalizeFoodForStorage(food)).toMatchObject({
			description: "My Breakfast Spinach",
			canonicalDescription: "Spinach, Raw",
		});
		expect(getCanonicalFoodDescription(food)).toBe("Spinach, Raw");
	});

	it("uses the current name when no separate canonical name exists", () => {
		expect(
			getCanonicalFoodDescription({
				description: "Spinach, Raw",
			}),
		).toBe("Spinach, Raw");
	});
});
