import { describe, expect, it } from "vitest";
import {
	getFoodPreferenceProfile,
	getResolvedFoodPreferences,
	getUnresolvedFoodPreferences,
	type FoodPreferenceResolution,
} from "$lib/utils/profile/foodPreferenceProfile";

const record = {
	unit_system: "metric" as const,
	allergens: ["Milk", "Banana sensitivity"],
	dietary_restrictions: ["Vegan"],
	prioritized_nutrient_ids: [1008],
	default_smoothie_serving_grams: 250,
	sensitive_acknowledged_at: "2026-07-31T00:00:00.000Z",
	regulatory_region_code: "US",
	regulatory_region_source: "account",
};

const resolutions: FoodPreferenceResolution[] = [{
	rawValue: "Milk",
	normalizedValue: "milk",
	ruleType: "allergen",
	status: "resolved",
	method: "direct_tag",
	policyVersionId: "00000000-0000-4000-8000-000000000001",
	languageCode: "und",
	ingredientTermId: null,
	ingredientAliasId: null,
	preferenceTermMappingId: null,
	tag: {
		id: "milk-tag",
		slug: "milk",
		label: "Milk",
		category: "allergen",
	},
}, {
	rawValue: "Banana sensitivity",
	normalizedValue: "banana sensitivity",
	ruleType: "allergen",
	status: "unresolved",
	method: "unresolved",
	policyVersionId: "00000000-0000-4000-8000-000000000001",
	languageCode: "und",
	ingredientTermId: null,
	ingredientAliasId: null,
	preferenceTermMappingId: null,
	tag: null,
}];

describe("food preference profile resolution", () => {
	it("keeps raw account values alongside server-reviewed resolutions", () => {
		const profile = getFoodPreferenceProfile(record, resolutions);

		expect(profile?.allergens).toEqual(["Milk", "Banana sensitivity"]);
		expect(profile?.preferenceResolutions).toEqual(resolutions);
	});

	it("separates eligible warning rules from unresolved saved text", () => {
		const profile = getFoodPreferenceProfile(record, resolutions);

		expect(getResolvedFoodPreferences(profile, "allergen"))
			.toEqual([resolutions[0]]);
		expect(getUnresolvedFoodPreferences(profile, "allergen"))
			.toEqual([resolutions[1]]);
		expect(getResolvedFoodPreferences(profile, "dietary_restriction"))
			.toEqual([]);
	});
});
