import { describe, expect, it } from "vitest";
import {
	formatChartNumber,
	formatSignedChartNumber,
	mergeNutrientOptions,
	normalizeNutrientOptions,
	normalizeServingUnit,
} from "$lib/utils/mix/ui/mixUi";

describe("mix UI utilities", () => {
	it("formats compact chart values", () => {
		expect(formatChartNumber(8.25)).toBe("8.3");
		expect(formatChartNumber(25.4)).toBe("25");
		expect(formatChartNumber(1250)).toBe("1.3k");
		expect(formatSignedChartNumber(-12.4)).toBe("-12");
	});

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
});
