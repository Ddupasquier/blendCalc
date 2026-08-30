import { describe, expect, it } from "vitest";
import {
	convertFoodServingMultiplier,
	convertServingAmount,
	convertServingQuantityToUnit,
	convertServingToGrams,
	getSourceServingMeasureOptions,
	getServingMeasureDimension,
	parseServingAmount,
	parseSourceServingMeasure,
	parseSourceWeightMeasure,
} from "$lib/utils/serving/servingAmount";
import { getFoodNutrientAmountForServingConversion } from "$lib/utils/food/nutrients/foodNutrients";
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

const foodWithReportedVolumeOnlyServing = {
	fdcId: 6,
	description: "Volume-only sauce",
	foodNutrients: [],
	foodServings: [
		{
			label: "1 package serving",
			milliliterVolume: 30,
			isPrimary: true,
			source: "user-label",
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

	it.each(["1 cookie", "2 crackers", "1 bottle", "3 dumplings"])(
		"preserves an unstandardized source count such as %s without inventing grams",
		(label) => {
			const parsed = parseSourceServingMeasure(label);
			expect(parsed).toMatchObject({
				quantity: Number(label.split(" ")[0]),
				unit: "item",
			});
			expect(
				convertServingAmount(parsed?.quantity ?? 0, parsed?.unit ?? "item"),
			).toMatchObject({
				grams: null,
				milliliters: null,
				servings: Number(label.split(" ")[0]),
				dimension: "count",
				available: true,
			});
		},
	);

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

		expect(conversion.available).toBe(true);
		expect(conversion.grams).toBeNull();
		expect(conversion.milliliters).toBeCloseTo(236.588);
		expect(conversion.density).toBeNull();
		expect(conversion.warning).toBeNull();
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

	it("keeps a source-defined volume serving on a volume basis without grams", () => {
		const [option] = getSourceServingMeasureOptions(
			foodWithReportedVolumeOnlyServing,
		);

		expect(
			convertServingAmount(2, option.value, foodWithReportedVolumeOnlyServing),
		).toMatchObject({
			grams: null,
			milliliters: 60,
			servings: 2,
			dimension: "volume",
			available: true,
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

	it("switches volume and count units through their exact native basis", () => {
		const volumeFood = {
			fdcId: 7,
			description: "Volume sauce",
			foodNutrients: [
				{
					nutrientId: 1008,
					nutrientName: "Energy",
					nutrientNumber: "208",
					unitName: "KCAL",
					value: 20,
					measurementBasis: {
						kind: "volume" as const,
						quantity: 30,
						unitKey: "ml",
					},
				},
			],
			foodServings: [
				{
					label: "2 tbsp",
					milliliterVolume: 29.5735,
					amount: 2,
					unitKey: "tbsp",
					isPrimary: true,
				},
			],
		} satisfies FoodItem;
		const countFood = {
			fdcId: 8,
			description: "Cookies",
			foodNutrients: [
				{
					nutrientId: 1008,
					nutrientName: "Energy",
					nutrientNumber: "208",
					unitName: "KCAL",
					value: 140,
					measurementBasis: {
						kind: "serving" as const,
						quantity: 1,
						unitKey: "serving",
						servingLabel: "2 cookies",
					},
				},
			],
			foodServings: [
				{
					label: "2 cookies",
					amount: 2,
					unitKey: "item",
					isPrimary: true,
				},
			],
		} satisfies FoodItem;

		expect(
			convertServingQuantityToUnit(2, "tbsp", "ml", volumeFood),
		).toBeCloseTo(29.5735);
		expect(convertServingAmount(1, "tbsp", volumeFood).servings).toBe(0.5);
		expect(convertServingAmount(1, "item", countFood).servings).toBe(0.5);
		expect(convertServingQuantityToUnit(2, "item", "item", countFood)).toBe(2);
	});

	it("does not apply one product serving's nutrients to a different serving label", () => {
		const cookieNutrientFood = {
			fdcId: 9,
			description: "Cookie nutrition",
			foodNutrients: [
				{
					nutrientId: 1008,
					nutrientName: "Energy",
					nutrientNumber: "208",
					unitName: "KCAL",
					value: 80,
					measurementBasis: {
						kind: "serving" as const,
						quantity: 1,
						unitKey: "serving",
						servingLabel: "1 cookie",
					},
				},
			],
		} satisfies FoodItem;
		const bottleConversion = convertFoodServingMultiplier(
			{
				label: "1 bottle",
				amount: 1,
				unitKey: "item",
				isPrimary: true,
			},
			1,
		);

		expect(
			getFoodNutrientAmountForServingConversion(
				cookieNutrientFood,
				1008,
				bottleConversion,
			),
		).toBeNull();
	});

	it("derives a 100g comparison only from a native serving with an exact gram weight", () => {
		const cookieFood = {
			fdcId: 10,
			description: "Exact package cookie",
			foodNutrients: [
				{
					nutrientId: 1008,
					nutrientName: "Energy",
					nutrientNumber: "208",
					unitName: "KCAL",
					value: 80,
					measurementBasis: {
						kind: "serving" as const,
						quantity: 1,
						unitKey: "serving",
						servingLabel: "1 cookie",
					},
				},
			],
			foodServings: [
				{
					label: "1 cookie (30 g)",
					gramWeight: 30,
					amount: 1,
					unitKey: "item",
					isPrimary: true,
					origin: "package-label" as const,
					gramWeightMethod: "source-reported" as const,
				},
			],
		} satisfies FoodItem;

		expect(
			getFoodNutrientAmountForServingConversion(cookieFood, 1008, {
				grams: 100,
				milliliters: null,
				servings: null,
				servingLabel: null,
				dimension: "weight",
				density: null,
				available: true,
				warning: null,
				method: "exact-unit-conversion",
				basis: "100g",
			}),
		).toBeCloseTo(266.667, 3);
	});

	it("does not derive 100g nutrition from a count serving with an unknown weight basis", () => {
		const cookieFood = {
			fdcId: 11,
			description: "Unverified package cookie",
			foodNutrients: [
				{
					nutrientId: 1008,
					nutrientName: "Energy",
					nutrientNumber: "208",
					unitName: "KCAL",
					value: 80,
					measurementBasis: {
						kind: "serving" as const,
						quantity: 1,
						unitKey: "serving",
						servingLabel: "1 cookie",
					},
				},
			],
			foodServings: [
				{
					label: "1 cookie",
					gramWeight: 30,
					amount: 1,
					unitKey: "item",
					isPrimary: true,
					gramWeightMethod: "unknown" as const,
				},
			],
		} satisfies FoodItem;

		expect(
			getFoodNutrientAmountForServingConversion(cookieFood, 1008, {
				grams: 100,
				milliliters: null,
				servings: null,
				servingLabel: null,
				dimension: "weight",
				density: null,
				available: true,
				warning: null,
				method: "exact-unit-conversion",
				basis: "100g",
			}),
		).toBeNull();
	});
});
