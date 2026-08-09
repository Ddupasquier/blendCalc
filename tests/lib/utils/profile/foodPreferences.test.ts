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
				allergens: ["peanuts"],
				dietaryRestrictions: [],
				prioritizedNutrientIds: [],
				defaultMixServingSize: "",
				defaultMixServingUnit: "g",
				sensitiveAcknowledged: false,
				regulatoryRegionCode: "",
				regulatoryRegionSource: null,
			}),
		).toBe("Confirm that you want these optional preferences saved to your account.");
	});

	it("rejects an unsupported regional label profile", () => {
		expect(
			getFoodPreferencesValidationError({
				unitSystem: null,
				allergens: [],
				dietaryRestrictions: [],
				prioritizedNutrientIds: [],
				defaultMixServingSize: "",
				defaultMixServingUnit: "g",
				sensitiveAcknowledged: true,
				regulatoryRegionCode: "ZZ",
				regulatoryRegionSource: "account",
			}, [{
				regionCode: "US",
				displayName: "United States",
				authority: "FDA",
			}]),
		).toBe("Choose a supported label region and try again.");
	});

	it("deduplicates nutrient priority ids", () => {
		expect(parsePrioritizedNutrientIds(["1008", "1008", "abc", "-1"])).toEqual([
			1008,
		]);
	});
});
