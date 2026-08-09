import { describe, expect, it } from "vitest";
import {
	findFoodNutrient,
	getFoodNutrientValue,
} from "$lib/utils/food/nutrients/foodNutrients";
import { NUTRIENT_IDS, type FoodItem } from "$lib/utils/food/types";

const sunflowerOilSearchResult = {
	fdcId: 1750349,
	description: "Oil, sunflower",
	sourceKey: "usda",
	foodNutrients: [
		{
			nutrientId: 1085,
			nutrientName: "Total fat (NLEA)",
			nutrientNumber: "298",
			unitName: "G",
			value: 93.2,
		},
	],
} satisfies FoodItem;

describe("food nutrient resolver", () => {
	it("maps oil Total fat (NLEA) to the app Total Fat vital", () => {
		expect(findFoodNutrient(sunflowerOilSearchResult, NUTRIENT_IDS.FAT))
			.toMatchObject({
				nutrientId: 1085,
				value: 93.2,
			});
	});

	it("does not derive calories when any macro value is missing", () => {
		expect(
			getFoodNutrientValue(sunflowerOilSearchResult, NUTRIENT_IDS.CALORIES),
		).toBeNull();
	});

	it("maps Foundation total sugars to Total Sugars", () => {
		const foundationFood = {
			fdcId: 2,
			description: "Foundation food",
			sourceKey: "usda",
			foodNutrients: [
				{
					nutrientId: 1063,
					nutrientName: "Sugars, Total",
					nutrientNumber: "269.3",
					unitName: "G",
					value: 12.5,
				},
			],
		} satisfies FoodItem;

		expect(getFoodNutrientValue(foundationFood, NUTRIENT_IDS.SUGAR)).toBe(12.5);
	});

	it("uses Atwater energy when standard calories are omitted", () => {
		const foundationFood = {
			fdcId: 3,
			description: "Foundation food",
			sourceKey: "usda",
			foodNutrients: [
				{
					nutrientId: 2047,
					nutrientName: "Energy (Atwater General Factors)",
					nutrientNumber: "957",
					unitName: "KCAL",
					value: 123,
				},
			],
		} satisfies FoodItem;

		expect(getFoodNutrientValue(foundationFood, NUTRIENT_IDS.CALORIES)).toBe(
			123,
		);
	});

	it("does not assume source-less nutrients use USDA equivalence mappings", () => {
		expect(getFoodNutrientValue({
			...sunflowerOilSearchResult,
			sourceKey: undefined,
		}, NUTRIENT_IDS.FAT)).toBeNull();
	});
});
