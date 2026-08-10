import { describe, expect, it } from "vitest";
import {
	clampNutritionViewingGrams,
	formatNutritionAmount,
	formatViewingGrams,
	getNutritionBasisLabel,
	MAX_NUTRITION_VIEWING_GRAMS,
	MIN_NUTRITION_VIEWING_GRAMS,
	NUTRITION_VIEWING_GRAM_STEP,
	scalePer100gValue,
	stepNutritionViewingGrams,
} from "$lib/utils/food/nutrients/nutritionDisplay";

describe("nutrition display helpers", () => {
	it("clamps viewing grams to supported nutrition detail bounds", () => {
		expect(clampNutritionViewingGrams(0)).toBe(MIN_NUTRITION_VIEWING_GRAMS);
		expect(clampNutritionViewingGrams(100)).toBe(100);
		expect(clampNutritionViewingGrams(5000)).toBe(MAX_NUTRITION_VIEWING_GRAMS);
		expect(clampNutritionViewingGrams(Number.NaN)).toBe(100);
	});

	it("uses 1g base increments and accepts accelerated hold steps", () => {
		expect(NUTRITION_VIEWING_GRAM_STEP).toBe(1);
		expect(clampNutritionViewingGrams(103)).toBe(103);
		expect(stepNutritionViewingGrams(100, "increase")).toBe(101);
		expect(stepNutritionViewingGrams(100, "decrease")).toBe(99);
		expect(stepNutritionViewingGrams(100, "increase", 50)).toBe(150);
		expect(stepNutritionViewingGrams(30, "decrease", 50)).toBe(
			MIN_NUTRITION_VIEWING_GRAMS,
		);
	});

	it("scales per-100g nutrient values for the selected viewing amount", () => {
		expect(scalePer100gValue(23, 100)).toBe(23);
		expect(scalePer100gValue(23, 150)).toBe(34.5);
		expect(scalePer100gValue(0.4, 50)).toBe(0.2);
		expect(scalePer100gValue(undefined, 100)).toBeNull();
	});

	it("formats nutrition amounts and basis labels for the detail panel", () => {
		expect(formatNutritionAmount(23)).toBe("23");
		expect(formatNutritionAmount(34.5)).toBe("34.5");
		expect(formatNutritionAmount(0.04)).toBe("0.04");
		expect(formatNutritionAmount(0.004)).toBe("<0.005");
		expect(formatNutritionAmount(0)).toBe("0");
		expect(formatNutritionAmount(undefined)).toBe("—");
		expect(formatViewingGrams(125)).toBe("125g");
		expect(getNutritionBasisLabel(100)).toBe("Per 100g food data");
		expect(getNutritionBasisLabel(125)).toBe("Per 125g viewing amount");
		expect(getNutritionBasisLabel(30, "2 tbsp")).toBe("Per 2 tbsp · 30g");
	});
});
