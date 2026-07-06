import { describe, expect, it } from "vitest";
import {
	findFdcNutrient,
	getFdcNutrientValue,
} from "$lib/utils/food/nutrients/fdcNutrients";
import { NUTRIENT_IDS, type FdcFood } from "$lib/utils/food/types";

const sunflowerOilSearchResult = {
	fdcId: 1750349,
	description: "Oil, sunflower",
	foodNutrients: [
		{
			nutrientId: 1085,
			nutrientName: "Total fat (NLEA)",
			nutrientNumber: "298",
			unitName: "G",
			value: 93.2,
		},
	],
} satisfies FdcFood;

describe("FDC nutrient resolver", () => {
	it("maps oil Total fat (NLEA) to the app Total Fat vital", () => {
		expect(findFdcNutrient(sunflowerOilSearchResult, NUTRIENT_IDS.FAT))
			.toMatchObject({
				nutrientId: 1085,
				value: 93.2,
			});
	});

	it("derives calories from macro values when FDC omits calories", () => {
		expect(
			getFdcNutrientValue(sunflowerOilSearchResult, NUTRIENT_IDS.CALORIES),
		).toBeCloseTo(838.8);
	});

	it("uses Foundation total sugars as a fallback for Total Sugars", () => {
		const foundationFood = {
			fdcId: 2,
			description: "Foundation food",
			foodNutrients: [
				{
					nutrientId: 1063,
					nutrientName: "Sugars, Total",
					nutrientNumber: "269.3",
					unitName: "G",
					value: 12.5,
				},
			],
		} satisfies FdcFood;

		expect(getFdcNutrientValue(foundationFood, NUTRIENT_IDS.SUGAR)).toBe(12.5);
	});

	it("uses Atwater energy when standard calories are omitted", () => {
		const foundationFood = {
			fdcId: 3,
			description: "Foundation food",
			foodNutrients: [
				{
					nutrientId: 2047,
					nutrientName: "Energy (Atwater General Factors)",
					nutrientNumber: "957",
					unitName: "KCAL",
					value: 123,
				},
			],
		} satisfies FdcFood;

		expect(getFdcNutrientValue(foundationFood, NUTRIENT_IDS.CALORIES)).toBe(
			123,
		);
	});
});
