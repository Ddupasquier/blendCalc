import { describe, expect, it } from "vitest";
import {
	formatNutrientUnitNameForDisplay,
	normalizeNutrientUnitName,
} from "$lib/utils/food/nutrients/nutrientUnitNames";

describe("nutrient unit names", () => {
	it("normalizes equivalent source units to canonical storage names", () => {
		expect(normalizeNutrientUnitName("micrograms")).toBe("UG");
		expect(normalizeNutrientUnitName("mcg")).toBe("UG");
		expect(normalizeNutrientUnitName("µg")).toBe("UG");
	});

	it("formats canonical units consistently for people", () => {
		expect(formatNutrientUnitNameForDisplay("G")).toBe("g");
		expect(formatNutrientUnitNameForDisplay("MG")).toBe("mg");
		expect(formatNutrientUnitNameForDisplay("UG")).toBe("mcg");
		expect(formatNutrientUnitNameForDisplay("KCAL")).toBe("kcal");
		expect(formatNutrientUnitNameForDisplay("KJ")).toBe("kJ");
		expect(formatNutrientUnitNameForDisplay("IU")).toBe("IU");
	});
});
