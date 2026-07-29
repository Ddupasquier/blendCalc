import { describe, expect, it } from "vitest";
import {
	compactFood,
	compactManagedFood,
	getCanonicalFoodDescription,
} from "$lib/utils/food/records/foodRecords";
import type { FdcFood } from "$lib/utils/food/types";

describe("compact food records", () => {
	it("keeps field-level source tracking in saved food snapshots", () => {
		const food: FdcFood = {
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
		};

		expect(compactFood(food).fieldProvenance).toEqual(food.fieldProvenance);
	});

	it("keeps safe barcode capture provenance in saved food snapshots", () => {
		const food: FdcFood = {
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

		expect(compactFood(food).barcodeProvenance).toEqual(food.barcodeProvenance);
	});

	it("keeps deep-dive source and category metadata in saved food snapshots", () => {
		const food: FdcFood = {
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
		};

		expect(compactFood(food)).toMatchObject({
			brandedFoodCategory: "Fresh fruit",
			sourceAttribution: food.sourceAttribution,
		});
		expect(compactFood(food).sourceAttribution)
			.not.toBe(food.sourceAttribution);
	});

	it("does not assume nutrients were reported when status is absent", () => {
		const food: FdcFood = {
			fdcId: 2,
			description: "Unknown nutrient status",
			foodNutrients: [{
				nutrientId: 1004,
				nutrientName: "Total Fat",
				nutrientNumber: "204",
				unitName: "G",
				value: 0,
			}],
		};

		expect(compactFood(food).reportedNutrientIds).toEqual([]);
	});

	it("normalizes every catalog-bound name before persistence", () => {
		const food: FdcFood = {
			fdcId: -3,
			description: "ROASTED ONION AND GARLIC PASTA SAUCE",
			nameProvenance: "user",
			foodNutrients: [],
		};

		expect(compactManagedFood(food)).toMatchObject({
			description: "Roasted Onion & Garlic Pasta Sauce",
			nameProvenance: "source",
		});
	});

	it("preserves the canonical name separately from a personal list name", () => {
		const food: FdcFood = {
			fdcId: 3,
			description: "My Breakfast Spinach",
			canonicalDescription: "Spinach, Raw",
			nameProvenance: "user",
			foodNutrients: [],
		};

		expect(compactFood(food)).toMatchObject({
			description: "My Breakfast Spinach",
			canonicalDescription: "Spinach, Raw",
		});
		expect(getCanonicalFoodDescription(food)).toBe("Spinach, Raw");
	});

	it("uses the current name when no separate canonical name exists", () => {
		expect(getCanonicalFoodDescription({
			description: "Spinach, Raw",
		})).toBe("Spinach, Raw");
	});
});
