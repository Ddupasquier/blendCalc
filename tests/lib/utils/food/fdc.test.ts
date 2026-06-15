import { describe, expect, it } from "vitest";
import { normalizeFdcFood } from "$lib/utils/food/fdc";

describe("FoodData Central normalization", () => {
	it("normalizes full food-detail nutrient records", () => {
		const food = normalizeFdcFood({
			fdcId: 123,
			description: "Detailed product",
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
});
