import { describe, expect, it } from "vitest";
import {
	mergeNutrientOptions,
	normalizeNutrientOptions,
	normalizeServingUnit,
} from "$lib/utils/mix/ui/mixUi";

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
});
