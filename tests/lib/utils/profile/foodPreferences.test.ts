import { describe, expect, it } from "vitest";
import {
	getExactServingSizeConversionPreview,
	getFoodPreferencesValidationError,
	getServingSizeGrams,
	parseRepeatedFoodPreferenceValues,
	parsePrioritizedNutrientIds,
} from "$lib/utils/profile/foodPreferences";

describe("food preference helpers", () => {
	it("normalizes repeated preference values without splitting exact wording", () => {
		expect(parseRepeatedFoodPreferenceValues([
			" dairy ",
			"peanut",
			"Dairy",
			"shellfish, molluscs",
		])).toEqual([
			"dairy",
			"peanut",
			"shellfish, molluscs",
		]);
	});

	it("converts US serving sizes to normalized grams", () => {
		expect(getServingSizeGrams("2", "oz")).toBeCloseTo(56.699);
		expect(getServingSizeGrams("150", "g")).toBe(150);
		expect(getServingSizeGrams("0", "g")).toBeNull();
	});

	it("previews exact weight conversions without estimating food density", () => {
		expect(getExactServingSizeConversionPreview("28.349523125", "g")).toBe(
			"28.3495 g = 1 oz · Exact unit conversion",
		);
		expect(getExactServingSizeConversionPreview("2", "oz")).toBe(
			"2 oz = 56.699 g · Exact unit conversion",
		);
		expect(getExactServingSizeConversionPreview("", "g")).toBeNull();
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
			}, {
				regulatoryRegionOptions: [{
					regionCode: "US",
					displayName: "United States",
					authority: "FDA",
				}],
			}),
		).toBe("Choose a supported label region and try again.");
	});

	it("rejects priority nutrients outside the database-provided choices", () => {
		expect(
			getFoodPreferencesValidationError({
				unitSystem: null,
				allergens: [],
				dietaryRestrictions: [],
				prioritizedNutrientIds: [999999],
				defaultMixServingSize: "",
				defaultMixServingUnit: "g",
				sensitiveAcknowledged: true,
				regulatoryRegionCode: "",
				regulatoryRegionSource: null,
			}, {
				allowedPriorityNutrientIds: [1003, 1008],
			}),
		).toBe("Choose priority nutrients from the available list and try again.");
	});

	it("deduplicates nutrient priority ids", () => {
		expect(parsePrioritizedNutrientIds(["1008", "1008", "abc", "-1"])).toEqual([
			1008,
		]);
	});
});
