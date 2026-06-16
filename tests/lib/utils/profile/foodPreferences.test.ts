import { describe, expect, it } from "vitest";
import {
	getFoodPreferencesValidationError,
	getServingSizeGrams,
	parsePreferenceList,
	parsePrioritizedNutrientIds,
} from "$lib/utils/profile/foodPreferences";

describe("food preference helpers", () => {
	it("normalizes comma-separated preference lists", () => {
		expect(parsePreferenceList(" dairy, peanut, Dairy,  shellfish ")).toEqual([
			"dairy",
			"peanut",
			"shellfish",
		]);
	});

	it("converts US serving sizes to normalized grams", () => {
		expect(getServingSizeGrams("2", "oz")).toBeCloseTo(56.699);
		expect(getServingSizeGrams("150", "g")).toBe(150);
		expect(getServingSizeGrams("0", "g")).toBeNull();
	});

	it("validates acknowledgement before saving sensitive preferences", () => {
		expect(
			getFoodPreferencesValidationError({
				unitSystem: null,
				foodPreferences: [],
				allergens: ["peanuts"],
				dietaryRestrictions: [],
				ingredientsToAvoid: [],
				prioritizedNutrientIds: [],
				defaultSmoothieServingSize: "",
				defaultSmoothieServingUnit: "g",
				sensitiveAcknowledged: false,
			}),
		).toBe("Confirm that you want these optional preferences saved to your account.");
	});

	it("deduplicates nutrient priority ids", () => {
		expect(parsePrioritizedNutrientIds(["1008", "1008", "abc", "-1"])).toEqual([
			1008,
		]);
	});
});
