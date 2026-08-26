import { describe, expect, it } from "vitest";
import {
	convertServingAmount,
	convertServingQuantityToUnit,
	convertServingToGrams,
	getSourceServingMeasureOptions,
	getServingMeasureDimension,
	parseServingAmount,
	parseSourceServingMeasure,
	parseSourceWeightMeasure,
} from "$lib/utils/serving/servingAmount";
import type { FoodItem } from "$lib/utils/food/types";

const unknownFood = {
	fdcId: 3,
	description: "Mystery ingredient",
	foodNutrients: [],
} satisfies FoodItem;

const foodWithReportedVolumeServing = {
	fdcId: 4,
	description: "Food with a reported cup weight",
	foodNutrients: [],
	foodServings: [
		{
			label: "1 cup",
			gramWeight: 245,
			amount: 1,
			unitKey: "cup",
			isPrimary: true,
			source: "usda",
			confidence: "unknown",
		},
	],
} satisfies FoodItem;

const customFood = {
	fdcId: -1,
	description: "Custom scoop",
	customDensityGramsPerMilliliter: 0.75,
	customDensityLabel: "custom serving",
	customDensityVariancePercent: 0,
	customDensityConfidence: "known",
	foodNutrients: [],
} satisfies FoodItem;

const foodWithReportedHouseholdServing = {
	fdcId: 5,
	description: "Banana, Raw",
	foodNutrients: [],
	foodServings: [
		{
			label: "1 medium banana (118 g)",
			gramWeight: 118,
			isPrimary: true,
			measureType: "household",
			isHouseholdMeasure: true,
			sourceMeasureKey: "banana-medium",
			origin: "source-household-measure",
			gramWeightMethod: "source-reported",
			source: "usda",
			confidence: "source-verified",
		},
	],
} satisfies FoodItem;

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
		expect(conversion.warning).toContain(
			"measured weight-to-volume conversion",
		);
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

	it("converts exact household servings without inventing a reusable unit", () => {
		const options = getSourceServingMeasureOptions(
			foodWithReportedHouseholdServing,
		);

		expect(options).toHaveLength(1);
		expect(options[0]).toMatchObject({
			label: "medium banana",
			gramWeight: 118,
		});
		expect(
			convertServingAmount(
				2,
				options[0].value,
				foodWithReportedHouseholdServing,
			),
		).toMatchObject({
			grams: 236,
			available: true,
			dimension: "weight",
			method: "source-reported",
		});
	});

	it("rejects a source-serving selector that does not belong to the food", () => {
		const [option] = getSourceServingMeasureOptions(
			foodWithReportedHouseholdServing,
		);

		expect(convertServingAmount(1, option.value, unknownFood)).toMatchObject({
			grams: null,
			available: false,
		});
	});

	it("preserves grams when switching between weight and a source serving", () => {
		const [option] = getSourceServingMeasureOptions(
			foodWithReportedHouseholdServing,
		);

		expect(
			convertServingQuantityToUnit(
				118,
				"g",
				option.value,
				foodWithReportedHouseholdServing,
			),
		).toBe(1);
		expect(
			convertServingQuantityToUnit(
				2,
				option.value,
				"g",
				foodWithReportedHouseholdServing,
			),
		).toBe(236);
	});
});
