import { describe, expect, it } from "vitest";
import {
	getDefaultServingAmount,
	mergeNutrientOptions,
	normalizeNutrientOptions,
	normalizeServingUnit,
} from "$lib/utils/mix/ui/mixUi";

const banana = {
	fdcId: 5,
	description: "Banana, Raw",
	foodNutrients: [],
	foodServings: [
		{
			label: "1 medium banana (118 g)",
			gramWeight: 118,
			isPrimary: true,
			gramWeightMethod: "source-reported" as const,
		},
	],
};

describe("mix UI utilities", () => {
	it("normalizes and merges nutrient options", () => {
		const normalized = normalizeNutrientOptions([
			{ id: 1003, label: "Protein" },
			{ id: null, label: "Broken" },
		]);

		expect(normalized).toEqual([{ id: 1003, label: "Protein" }]);
		expect(
			mergeNutrientOptions(normalized, [
				{ id: 1003, label: "Duplicate" },
				{ id: 2000, label: "Sugar" },
			]),
		).toEqual([
			{ id: 1003, label: "Protein" },
			{ id: 2000, label: "Sugar" },
		]);
	});

	it("normalizes serving units from loose strings", () => {
		expect(normalizeServingUnit(" fluid ounces ")).toBe("floz");
		expect(normalizeServingUnit("TBSP")).toBe("tbsp");
		expect(normalizeServingUnit("unknown")).toBeNull();
	});

	it("uses an exact primary household serving as the default", () => {
		const serving = getDefaultServingAmount(banana, {
			preferredServingGrams: 250,
			preferredWeightUnit: "oz",
		});

		expect(serving.quantity).toBe(1);
		expect(serving.unit).toMatch(/^source-serving:/);
		expect(normalizeServingUnit(serving.unit, banana)).toBe(serving.unit);
		expect(normalizeServingUnit(serving.unit)).toBeNull();
	});

	it("prefers an exact household measure over a legacy 100g default", () => {
		const serving = getDefaultServingAmount(
			{
				...banana,
				servingSize: 100,
				servingSizeUnit: "g",
				foodServings: [
					{
						label: "100g",
						gramWeight: 100,
						amount: 100,
						unitKey: "g",
						isPrimary: true,
						origin: "source-weight",
						gramWeightMethod: "source-reported",
					},
					{
						label: "2 cups (100g)",
						gramWeight: 100,
						amount: 2,
						unitKey: "cup",
						isPrimary: false,
						isHouseholdMeasure: true,
						origin: "source-household-measure",
						gramWeightMethod: "source-reported",
					},
				],
			},
			{ preferredServingGrams: 250 },
		);

		expect(serving).toEqual({ quantity: 2, unit: "cup" });
	});

	it("prefers a source-defined household count over a primary weight serving", () => {
		const serving = getDefaultServingAmount({
			...banana,
			foodServings: [
				{
					label: "100g",
					gramWeight: 100,
					amount: 100,
					unitKey: "g",
					isPrimary: true,
					origin: "source-weight",
					gramWeightMethod: "source-reported",
				},
				{
					label: "1 medium banana (118 g)",
					gramWeight: 118,
					isPrimary: false,
					isHouseholdMeasure: true,
					origin: "source-household-measure",
					gramWeightMethod: "source-reported",
				},
			],
		});

		expect(serving.quantity).toBe(1);
		expect(serving.unit).toMatch(/^source-serving:/);
	});

	it("uses the account starting amount only when no exact serving exists", () => {
		const serving = getDefaultServingAmount(undefined, {
			preferredServingGrams: 56.69904625,
			preferredWeightUnit: "oz",
		});

		expect(serving.quantity).toBeCloseTo(2);
		expect(serving.unit).toBe("oz");
	});
});
