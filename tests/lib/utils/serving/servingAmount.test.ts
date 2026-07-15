import { describe, expect, it } from "vitest";
import {
	convertServingAmount,
	convertServingToGrams,
	getServingMeasureDimension,
} from "$lib/utils/serving/servingAmount";
import type { FdcFood } from "$lib/utils/food/types";

const sunflowerOil = {
	fdcId: 1,
	description: "Sunflower oil",
	foodCategory: "Vegetable & Cooking Oils",
	foodNutrients: [],
} satisfies FdcFood;

const twoPercentMilk = {
	fdcId: 2,
	description: "2% milk",
	foodCategory: "Milk",
	foodNutrients: [],
} satisfies FdcFood;

const unknownFood = {
	fdcId: 3,
	description: "Mystery ingredient",
	foodNutrients: [],
} satisfies FdcFood;

const customFood = {
	fdcId: -1,
	description: "Custom scoop",
	customDensityGramsPerMilliliter: 0.75,
	customDensityLabel: "custom serving",
	customDensityVariancePercent: 0,
	customDensityConfidence: "known",
	foodNutrients: [],
} satisfies FdcFood;

describe("serving amount conversion", () => {
	it("keeps weight conversion exact", () => {
		expect(getServingMeasureDimension("oz")).toBe("weight");
		expect(convertServingToGrams(2, "oz")).toBeCloseTo(56.7);
	});

	it("converts oil volume with a narrow density range", () => {
		const conversion = convertServingAmount(1, "tbsp", sunflowerOil);

		expect(conversion.dimension).toBe("volume");
		expect(conversion.grams).toBeCloseTo(13.46, 1);
		expect(conversion.density?.label).toBe("cooking oil");
		expect(conversion.range?.minGrams).toBeCloseTo(13.06, 1);
		expect(conversion.range?.maxGrams).toBeCloseTo(13.87, 1);
		expect(conversion.warning).toContain("±3%");
	});

	it("converts milk cups using milk density", () => {
		const conversion = convertServingAmount(1, "cup", twoPercentMilk);

		expect(conversion.grams).toBeCloseTo(243.6858872);
		expect(conversion.density?.label).toBe("milk");
		expect(conversion.warning).toContain("milk density");
	});

	it("uses a rough warning for unknown volume densities", () => {
		const conversion = convertServingAmount(1, "cup", unknownFood);

		expect(conversion.grams).toBeCloseTo(236.58824);
		expect(conversion.density?.confidence).toBe("rough");
		expect(conversion.warning).toContain("±50%");
	});

	it("uses user-provided custom density before generic estimates", () => {
		const conversion = convertServingAmount(2, "tbsp", customFood);

		expect(conversion.grams).toBeCloseTo(22.18, 1);
		expect(conversion.density?.label).toBe("custom serving");
		expect(conversion.warning).toContain("custom density you entered");
	});
});
