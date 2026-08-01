import { describe, expect, it } from "vitest";
import {
	convertServingAmount,
	convertServingToGrams,
	getServingMeasureDimension,
	parseServingAmount,
	parseSourceServingMeasure,
	parseSourceWeightMeasure,
} from "$lib/utils/serving/servingAmount";
import type { FdcFood } from "$lib/utils/food/types";

const unknownFood = {
	fdcId: 3,
	description: "Mystery ingredient",
	foodNutrients: [],
} satisfies FdcFood;

const foodWithReportedVolumeServing = {
	fdcId: 4,
	description: "Food with a reported cup weight",
	foodNutrients: [],
	foodServings: [{
		label: "1 cup",
		gramWeight: 245,
		amount: 1,
		unitKey: "cup",
		isPrimary: true,
		source: "usda",
		confidence: "unknown",
	}],
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

	it("requires explicit source units while retaining the interactive default", () => {
		expect(parseSourceServingMeasure("30")).toBeNull();
		expect(parseSourceServingMeasure("30 g")).toMatchObject({
			quantity: 30,
			unit: "g",
		});
		expect(parseServingAmount("30")).toMatchObject({
			grams: 30,
			unit: "g",
		});
	});

	it("finds explicit source weights inside composite serving labels", () => {
		expect(parseSourceWeightMeasure("2 tbsp (30 g)")).toMatchObject({
			quantity: 30,
			unit: "g",
		});
		expect(parseSourceWeightMeasure("4 olives (15 g)")).toMatchObject({
			quantity: 15,
			unit: "g",
		});
		expect(parseSourceWeightMeasure("4 olives")).toBeNull();
	});

	it("does not guess a volume conversion from the food name or category", () => {
		const conversion = convertServingAmount(1, "cup", unknownFood);

		expect(conversion.available).toBe(false);
		expect(conversion.grams).toBeNull();
		expect(conversion.density).toBeNull();
		expect(conversion.warning).toContain("measured weight-to-volume conversion");
	});

	it("uses a user-provided exact density", () => {
		const conversion = convertServingAmount(2, "tbsp", customFood);

		expect(conversion.available).toBe(true);
		expect(conversion.grams).toBeCloseTo(22.18, 1);
		expect(conversion.density?.label).toBe("custom serving");
		expect(conversion.warning).toBeNull();
	});

	it("derives volume conversion from a reported serving pair", () => {
		const conversion = convertServingAmount(
			0.5,
			"cup",
			foodWithReportedVolumeServing,
		);

		expect(conversion.available).toBe(true);
		expect(conversion.grams).toBeCloseTo(122.5);
		expect(conversion.density?.label).toBe("1 cup");
		expect(conversion.warning).toBeNull();
		expect(conversion.method).toBe("calculated-conversion");
		expect(conversion.basis).toContain("1 cup = 245g");
	});
});
