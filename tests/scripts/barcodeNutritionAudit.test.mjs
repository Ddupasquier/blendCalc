import { describe, expect, it } from "vitest";
import {
	auditNutrientRelationships,
	auditOpenFoodFactsServingBasis,
	auditPer100ServingRoundTrip,
	auditUsdaLabelConsistency,
	canonicalizeUsdaNutrients,
	compareCrossSourceNutrients,
	createNutrientMap,
	mapOpenFoodFactsPer100Nutrients,
	normalizeAuditUnit,
	valuesAgree,
} from "../../scripts/lib/barcode/barcodeNutritionAudit.mjs";

const referenceData = {
	definitions: [
		{
			nutrient_id: 1004,
			nutrient_name: "Total lipid (fat)",
			nutrient_number: "204",
			default_unit_name: "G",
		},
		{
			nutrient_id: 1008,
			nutrient_name: "Energy",
			nutrient_number: "208",
			default_unit_name: "KCAL",
		},
		{
			nutrient_id: 1079,
			nutrient_name: "Fiber, total dietary",
			nutrient_number: "291",
			default_unit_name: "G",
		},
	],
	equivalences: [
		{
			source_key: "usda",
			source_nutrient_id: 1085,
			canonical_nutrient_id: 1004,
		},
	],
	mappings: [
		{
			source_key: "open-food-facts",
			source_nutrient_key: "fat",
			source_unit_name: "G",
			nutrient_id: 1004,
			nutrient_name: "Total lipid (fat)",
			nutrient_number: "204",
			default_unit_name: "G",
			priority: 0,
			enabled: true,
			review_status: "approved",
		},
		{
			source_key: "open-food-facts",
			source_nutrient_key: "sodium",
			source_unit_name: "G",
			nutrient_id: 1093,
			nutrient_name: "Sodium, Na",
			nutrient_number: "307",
			default_unit_name: "MG",
			priority: 0,
			enabled: true,
			review_status: "approved",
		},
	],
	conversions: [
		{
			source_key: "open-food-facts",
			nutrient_id: 1093,
			from_unit_name: "G",
			to_unit_name: "MG",
			multiplier: 1000,
		},
	],
};

describe("barcode nutrition audit helpers", () => {
	it("normalizes microgram aliases and uses bounded numeric equality", () => {
		expect(normalizeAuditUnit("µg")).toBe("UG");
		expect(valuesAgree(12.5, 12.50001)).toBe(true);
		expect(valuesAgree(12.5, 13)).toBe(false);
	});

	it("prefers an exact canonical USDA nutrient over an alias", () => {
		const nutrients = canonicalizeUsdaNutrients({
			foodNutrients: [
				{
					nutrient: { id: 1085, name: "Total fat (NLEA)", unitName: "g" },
					amount: 7,
				},
				{
					nutrient: { id: 1004, name: "Total lipid (fat)", unitName: "g" },
					amount: 8,
				},
			],
		}, referenceData);

		expect(nutrients).toHaveLength(1);
		expect(nutrients[0]).toMatchObject({ nutrientId: 1004, value: 8 });
	});

	it("round-trips per-100g values through a source serving", () => {
		const result = auditPer100ServingRoundTrip([
			{ nutrientId: 1004, value: 31.25 },
			{ nutrientId: 1079, value: 6.25 },
		], 32);
		expect(result.checked).toBe(2);
		expect(result.mismatched).toEqual([]);
	});

	it("compares USDA label servings with per-100g nutrient values", () => {
		const { nutrientMap } = createNutrientMap([
			{ nutrientId: 1004, unitName: "G", value: 31.25 },
		]);
		const result = auditUsdaLabelConsistency({
			servingSize: 32,
			servingSizeUnit: "GRM",
			labelNutrients: { fat: { value: 10 } },
		}, nutrientMap);

		expect(result.checked).toBe(1);
		expect(result.mismatched).toEqual([]);
	});

	it("maps approved OFF fields and verifies serving basis", () => {
		const product = {
			serving_quantity: 25,
			serving_quantity_unit: "g",
			nutriments: {
				fat_100g: 20,
				fat_serving: 5,
				fat_unit: "g",
				sodium_100g: 0.4,
				sodium_serving: 0.1,
				sodium_unit: "g",
			},
		};
		expect(
			mapOpenFoodFactsPer100Nutrients(product, referenceData),
		).toEqual([
			expect.objectContaining({ nutrientId: 1004, value: 20 }),
			expect.objectContaining({ nutrientId: 1093, value: 400 }),
		]);
		expect(
			auditOpenFoodFactsServingBasis(product, referenceData).mismatched,
		).toEqual([]);
	});

	it("flags impossible nutrient relationships and material source conflicts", () => {
		const { nutrientMap } = createNutrientMap([
			{ nutrientId: 1004, unitName: "G", value: 1 },
			{ nutrientId: 1258, unitName: "G", value: 3 },
		]);
		expect(auditNutrientRelationships(nutrientMap)).toEqual([
			expect.objectContaining({ label: "saturated-fat-total-fat" }),
		]);

		const secondary = createNutrientMap([
			{ nutrientId: 1004, unitName: "G", value: 10 },
		]).nutrientMap;
		expect(
			compareCrossSourceNutrients(nutrientMap, secondary).conflicts,
		).toHaveLength(1);
	});
});
