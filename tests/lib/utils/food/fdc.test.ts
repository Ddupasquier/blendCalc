import { describe, expect, it } from "vitest";
import { normalizeFdcFood } from "$lib/utils/food/sources/fdc";

describe("FoodData Central normalization", () => {
	it("normalizes full food-detail nutrient records", () => {
		const food = normalizeFdcFood({
			fdcId: 123,
			description: "DETAILED PRODUCT",
			foodNutrients: [
				{
					amount: 42,
					nutrient: {
						id: 1092,
						name: "Potassium, K",
						number: "306",
						unitName: "mg",
					},
				},
			],
		});

		expect(food.description).toBe("Detailed Product");
		expect(food.nameProvenance).toBe("source");
		expect(food.foodNutrients).toEqual([
			{
				nutrientId: 1092,
				nutrientName: "Potassium, K",
				nutrientNumber: "306",
				unitName: "mg",
				value: 42,
			},
		]);
	});

	it("preserves reported zeroes while dropping missing or invalid nutrients", () => {
		const food = normalizeFdcFood({
			fdcId: 124,
			description: "ZERO TEST PRODUCT",
			foodNutrients: [
				{
					amount: 0,
					nutrient: {
						id: 1004,
						name: "Total lipid (fat)",
						number: "204",
						unitName: "g",
					},
				},
				{
					amount: null as unknown as number,
					nutrient: {
						id: 1003,
						name: "Protein",
						number: "203",
						unitName: "g",
					},
				},
				{
					amount: 10,
					nutrient: {
						id: 1005,
						name: "",
						number: "205",
						unitName: "g",
					},
				},
			],
		});

		expect(food.foodNutrients).toEqual([
			expect.objectContaining({ nutrientId: 1004, value: 0 }),
		]);
		expect(food.reportedNutrientIds).toEqual([1004]);
	});

	it("preserves exact USDA household portion weights as serving conversions", () => {
		const food = normalizeFdcFood({
			fdcId: 171032,
			description: "Oil, apricot kernel",
			foodNutrients: [],
			foodPortions: [
				{
					amount: 1,
					gramWeight: 13.6,
					portionDescription: "1 tablespoon",
					sequenceNumber: 1,
				},
				{
					amount: 1,
					gramWeight: 218,
					portionDescription: "1 cup",
					sequenceNumber: 2,
				},
				{
					amount: 1,
					gramWeight: null as unknown as number,
					portionDescription: "missing weight",
					sequenceNumber: 3,
				},
			],
		});

		expect(food.hasSourceServing).toBe(true);
		expect(food.foodServings).toEqual([
			{
				label: "1 tablespoon",
				gramWeight: 13.6,
				amount: 1,
				isPrimary: true,
				source: "usda",
				sourceReference: "171032",
				confidence: "unknown",
			},
			{
				label: "1 cup",
				gramWeight: 218,
				amount: 1,
				isPrimary: false,
				source: "usda",
				sourceReference: "171032",
				confidence: "unknown",
			},
		]);
	});
});
