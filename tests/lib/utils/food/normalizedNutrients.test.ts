import { describe, expect, it } from "vitest";
import {
	hydrateFoodWithNormalizedNutrients,
	normalizedRowsToNutrients,
	type NormalizedNutrientRow,
} from "$lib/utils/food/nutrients/normalizedNutrients";
import type { FdcFood } from "$lib/utils/food/types";

const fallbackFood = {
	fdcId: 1,
	description: "Fallback food",
	reportedNutrientIds: [1003],
	foodNutrients: [
		{
			nutrientId: 1003,
			nutrientName: "Protein",
			nutrientNumber: "203",
			unitName: "G",
			value: 4,
		},
	],
} satisfies FdcFood;

const normalizedProtein = {
	nutrientId: 1003,
	nutrientName: "Protein",
	nutrientNumber: "203",
	unitName: "g",
	value: 12.5,
	valueOrigin: "reported",
	source: "usda",
	sourceReference: "12345",
	confidence: "source-verified",
} satisfies NormalizedNutrientRow;

describe("normalized food nutrients", () => {
	it("hydrates the existing food contract with normalized values", () => {
		const hydrated = hydrateFoodWithNormalizedNutrients(fallbackFood, [
			normalizedProtein,
			{
				...normalizedProtein,
				nutrientId: 1008,
				nutrientName: "Energy",
				nutrientNumber: "208",
				unitName: "kcal",
				value: 90,
				valueOrigin: "derived",
			},
		]);

		expect(hydrated.foodNutrients).toEqual([
			expect.objectContaining({
				nutrientId: 1003,
				unitName: "G",
				value: 12.5,
				source: "usda",
				confidence: "source-verified",
			}),
			expect.objectContaining({
				nutrientId: 1008,
				unitName: "KCAL",
				valueOrigin: "derived",
			}),
		]);
		expect(hydrated.reportedNutrientIds).toEqual([1003]);
	});

	it("keeps the JSON snapshot when normalized rows are unavailable", () => {
		expect(hydrateFoodWithNormalizedNutrients(fallbackFood, undefined))
			.toMatchObject({
				foodNutrients: [expect.objectContaining({ value: 4 })],
				reportedNutrientIds: [1003],
			});
	});

	it("drops invalid and duplicate normalized rows", () => {
		expect(normalizedRowsToNutrients([
			normalizedProtein,
			{ ...normalizedProtein, value: 99 },
			{ ...normalizedProtein, nutrientId: 1004, value: Number.NaN },
		])).toEqual([
			expect.objectContaining({ nutrientId: 1003, value: 12.5 }),
		]);
	});
});
