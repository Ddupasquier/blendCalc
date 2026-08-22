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
	foodServings: [{
		label: "1 medium banana (118 g)",
		gramWeight: 118,
		isPrimary: true,
		gramWeightMethod: "source-reported" as const,
	}],
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
		const serving = getDefaultServingAmount(banana);

		expect(serving.quantity).toBe(1);
		expect(serving.unit).toMatch(/^source-serving:/);
		expect(normalizeServingUnit(serving.unit, banana)).toBe(serving.unit);
		expect(normalizeServingUnit(serving.unit)).toBeNull();
	});
});
