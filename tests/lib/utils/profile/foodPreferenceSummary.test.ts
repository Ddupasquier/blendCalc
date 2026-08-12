import { describe, expect, it } from "vitest";
import { getSavedFoodPreferenceSummaryItems } from "$lib/utils/profile/foodPreferenceSummary";

describe("saved food preference summary", () => {
	it("formats only persisted values with readable units and database labels", () => {
		expect(
			getSavedFoodPreferenceSummaryItems({
				foodPreferences: {
					unitSystem: "us",
					allergens: ["peanut"],
					dietaryRestrictions: ["vegan"],
					prioritizedNutrientIds: [1003],
					defaultMixServingGrams: 28.349523125,
					sensitiveAcknowledgedAt: "2026-08-11T00:00:00.000Z",
					regulatoryRegionCode: "US",
					regulatoryRegionSource: "account",
					preferenceResolutions: [],
				},
				priorityNutrientOptions: [{
					id: 1003,
					label: "Protein",
					unit: "g",
					nutrientNumber: "203",
					sortOrder: 1,
					highlight: true,
					defaultGoal: 25,
				}],
				regulatoryRegionOptions: [{
					regionCode: "US",
					displayName: "United States",
					authority: "FDA",
				}],
			}),
		).toEqual([
			{ label: "Label region", value: "United States" },
			{ label: "Units", value: "US units" },
			{ label: "Serving", value: "1 oz" },
			{ label: "Allergens", value: "peanut" },
			{ label: "Dietary restrictions", value: "vegan" },
			{ label: "Priority nutrients", value: "Protein" },
		]);
	});
});
