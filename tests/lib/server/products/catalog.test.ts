import { describe, expect, it } from "vitest";
import { validateSharedProductFood } from "$lib/server/products/catalog.server";
import { NUTRIENT_IDS, type FdcFood } from "$lib/utils/food/types";

const createFood = (overrides: Partial<FdcFood> = {}): FdcFood => ({
	fdcId: -1,
	description: "Test product",
	barcode: "00012345678905",
	customServingWeightGrams: 30,
	foodNutrients: [
		{
			nutrientId: NUTRIENT_IDS.CARBS,
			nutrientName: "Total Carbohydrate",
			nutrientNumber: "205",
			unitName: "G",
			value: 20,
		},
		{
			nutrientId: NUTRIENT_IDS.SUGAR,
			nutrientName: "Total Sugars",
			nutrientNumber: "269",
			unitName: "G",
			value: 8,
		},
	],
	...overrides,
});

describe("shared product validation", () => {
	it("accepts a valid normalized barcode and nutrition label", () => {
		expect(validateSharedProductFood(createFood())).toEqual({
			barcode: "00012345678905",
			issues: [],
			valid: true,
		});
	});

	it("rejects impossible macro relationships", () => {
		const result = validateSharedProductFood(createFood({
			foodNutrients: [
				{
					nutrientId: NUTRIENT_IDS.CARBS,
					nutrientName: "Total Carbohydrate",
					nutrientNumber: "205",
					unitName: "G",
					value: 10,
				},
				{
					nutrientId: NUTRIENT_IDS.SUGAR,
					nutrientName: "Total Sugars",
					nutrientNumber: "269",
					unitName: "G",
					value: 12,
				},
			],
		}));

		expect(result.valid).toBe(false);
		expect(result.issues).toContain(
			"Total sugars cannot exceed total carbohydrates.",
		);
	});

	it("rejects missing labels and invalid nutrient values", () => {
		const result = validateSharedProductFood(createFood({
			description: " ",
			foodNutrients: [
				{
					nutrientId: NUTRIENT_IDS.PROTEIN,
					nutrientName: "Protein",
					nutrientNumber: "203",
					unitName: "G",
					value: -1,
				},
			],
		}));

		expect(result.valid).toBe(false);
		expect(result.issues).toEqual(expect.arrayContaining([
			"A product name is required.",
			"Protein has an invalid value.",
		]));
	});
});
