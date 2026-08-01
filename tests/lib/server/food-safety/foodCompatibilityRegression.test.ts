import { describe, expect, it } from "vitest";
import { annotateFoodWithFoodSafety } from "$lib/server/food-safety/foodSafetyEvaluation.server";
import type {
	FoodPreferenceConflictRule,
	FoodSafetyPolicy,
} from "$lib/server/food-safety/foodSafetyPolicy.server";
import type { FoodPreferenceProfile } from "$lib/utils/profile/foodPreferenceProfile";
import {
	FOOD_COMPATIBILITY_REGRESSION_CORPUS,
} from "../../../fixtures/foodCompatibilityRegressionCorpus";

const conflictMap: Record<string, string[]> = {
	"gluten-free": ["gluten", "wheat"],
	halal: ["pork", "alcohol", "gelatin"],
	kosher: ["pork", "shellfish", "mollusc", "gelatin"],
	vegan: [
		"meat",
		"pork",
		"animal-fat",
		"animal-stock",
		"gelatin",
		"collagen",
		"bee-product",
		"egg",
		"milk",
		"dairy",
		"fish",
		"shellfish",
		"mollusc",
		"animal-rennet",
		"insect-derived",
	],
	vegetarian: [
		"meat",
		"pork",
		"animal-fat",
		"animal-stock",
		"gelatin",
		"collagen",
		"fish",
		"shellfish",
		"mollusc",
	],
};

const labelByPreference: Record<string, string> = {
	"gluten-free": "Gluten-free",
	halal: "Halal",
	kosher: "Kosher",
	vegan: "Vegan",
	vegetarian: "Vegetarian",
};

const preferenceConflictRules: FoodPreferenceConflictRule[] =
	Object.entries(conflictMap).flatMap(([preferenceSlug, factSlugs]) =>
		factSlugs.map((factSlug, priority) => ({
			preferenceSlug,
			preferenceLabel: labelByPreference[preferenceSlug],
			preferenceCategory: "dietary",
			factSlug,
			factLabel: factSlug,
			level: "warning",
			warningCode: "FOOD_RESTRICTION_CONFLICT",
			priority,
		}))
	);

const policy: FoodSafetyPolicy = {
	version: 1,
	reviewedAt: "2026-07-29T00:00:00.000Z",
	preferenceConflictRules,
	compatibilityMatchRules: [],
	regionalProfiles: [],
};

const createProfile = (
	allergens: string[] = [],
	dietaryRestrictions: string[] = [],
): FoodPreferenceProfile => ({
	unitSystem: "metric",
	allergens,
	dietaryRestrictions,
	prioritizedNutrientIds: [],
	defaultSmoothieServingGrams: null,
	sensitiveAcknowledgedAt: "2026-07-29T00:00:00.000Z",
	regulatoryRegionCode: null,
	regulatoryRegionSource: null,
	preferenceResolutions: [
		...allergens.map((value) => ({
			rawValue: value,
			normalizedValue: value.toLocaleLowerCase().trim().replace(/\s+/g, " "),
			ruleType: "allergen" as const,
			status: "resolved" as const,
			method: "direct_tag" as const,
			policyVersionId: "00000000-0000-4000-8000-000000000001",
			languageCode: "und",
			ingredientTermId: null,
			ingredientAliasId: null,
			preferenceTermMappingId: null,
			tag: {
				id: `test-allergen-${value}`,
				slug: value.toLocaleLowerCase().trim().replace(/\s+/g, "-"),
				label: value,
				category: "allergen",
			},
		})),
		...dietaryRestrictions.map((value) => ({
			rawValue: value,
			normalizedValue: value.toLocaleLowerCase().trim().replace(/\s+/g, " "),
			ruleType: "dietary_restriction" as const,
			status: "resolved" as const,
			method: "direct_tag" as const,
			policyVersionId: "00000000-0000-4000-8000-000000000001",
			languageCode: "und",
			ingredientTermId: null,
			ingredientAliasId: null,
			preferenceTermMappingId: null,
			tag: {
				id: `test-restriction-${value}`,
				slug: value.toLocaleLowerCase().trim().replace(/\s+/g, "-"),
				label: value,
				category: "dietary",
			},
		})),
	],
});

describe("real-product food compatibility regression corpus", () => {
	it.each(FOOD_COMPATIBILITY_REGRESSION_CORPUS)(
		"$name",
		({ food, preferences, expectedWarningLabels, expectedIssueCodes }) => {
			const evaluated = annotateFoodWithFoodSafety(food, {
				profile: createProfile(
					preferences.allergens,
					preferences.dietaryRestrictions,
				),
				policy,
			});
			const warnings = evaluated.preferenceWarnings ?? [];

			expect(warnings.map((warning) => warning.label).sort())
				.toEqual([...expectedWarningLabels].sort());
			if (expectedIssueCodes) {
				expect(new Set(warnings.map((warning) => warning.code)))
					.toEqual(new Set(expectedIssueCodes));
			}
			expect(evaluated.compatibilitySummary?.policyVersion).toBe(1);
		},
	);
});
