import type { Database } from "$lib/types/database.types";

export type FoodPreferenceRecord =
	Database["public"]["Tables"]["user_food_preferences"]["Row"];

export type FoodPreferenceProfileSource = Pick<
	FoodPreferenceRecord,
	| "unit_system"
	| "allergens"
	| "dietary_restrictions"
	| "prioritized_nutrient_ids"
	| "default_smoothie_serving_grams"
	| "sensitive_acknowledged_at"
	| "regulatory_region_code"
	| "regulatory_region_source"
>;

export type FoodPreferenceRuleType = "allergen" | "dietary_restriction";
export type FoodPreferenceResolutionStatus = "resolved" | "unresolved";
export type FoodPreferenceResolutionMethod =
	| "direct_tag"
	| "canonical_ingredient"
	| "ingredient_alias"
	| "unresolved";

export type FoodPreferenceResolution = {
	rawValue: string;
	normalizedValue: string;
	ruleType: FoodPreferenceRuleType;
	status: FoodPreferenceResolutionStatus;
	method: FoodPreferenceResolutionMethod;
	policyVersionId: string;
	languageCode: string;
	ingredientTermId: string | null;
	ingredientAliasId: string | null;
	preferenceTermMappingId: string | null;
	tag: {
		id: string;
		slug: string;
		label: string;
		category: string;
	} | null;
};

export type FoodPreferenceProfile = {
	unitSystem: FoodPreferenceRecord["unit_system"];
	allergens: string[];
	dietaryRestrictions: string[];
	prioritizedNutrientIds: number[];
	defaultMixServingGrams: number | null;
	sensitiveAcknowledgedAt: string | null;
	regulatoryRegionCode: string | null;
	regulatoryRegionSource: "account" | "device" | null;
	preferenceResolutions: FoodPreferenceResolution[];
};

export const getFoodPreferenceProfile = (
	record: FoodPreferenceProfileSource | null | undefined,
	preferenceResolutions: FoodPreferenceResolution[] = [],
): FoodPreferenceProfile | null => {
	if (!record) return null;

	return {
		unitSystem: record.unit_system,
		allergens: [...(record.allergens ?? [])],
		dietaryRestrictions: [...(record.dietary_restrictions ?? [])],
		prioritizedNutrientIds: [...(record.prioritized_nutrient_ids ?? [])],
		defaultMixServingGrams: record.default_smoothie_serving_grams,
		sensitiveAcknowledgedAt: record.sensitive_acknowledged_at,
		regulatoryRegionCode: record.regulatory_region_code,
		regulatoryRegionSource: record.regulatory_region_source as
			| "account"
			| "device"
			| null,
		preferenceResolutions: [...preferenceResolutions],
	};
};

export const getResolvedFoodPreferences = (
	profile: FoodPreferenceProfile | null,
	ruleType?: FoodPreferenceRuleType,
) => (profile?.preferenceResolutions ?? []).filter((resolution) =>
	resolution.status === "resolved" &&
	resolution.tag !== null &&
	(!ruleType || resolution.ruleType === ruleType)
);

export const getUnresolvedFoodPreferences = (
	profile: FoodPreferenceProfile | null,
	ruleType?: FoodPreferenceRuleType,
) => (profile?.preferenceResolutions ?? []).filter((resolution) =>
	resolution.status === "unresolved" &&
	(!ruleType || resolution.ruleType === ruleType)
);

export const isMissingFoodPreferencesTableError = (
	error: { code?: string; message?: string } | null | undefined,
) => {
	const message = error?.message?.toLowerCase() ?? "";

	return (
		error?.code === "42P01" ||
		error?.code === "PGRST205" ||
		message.includes("user_food_preferences") ||
		message.includes("could not find the table")
	);
};
