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
>;

export type FoodPreferenceProfile = {
	unitSystem: FoodPreferenceRecord["unit_system"];
	allergens: string[];
	dietaryRestrictions: string[];
	prioritizedNutrientIds: number[];
	defaultSmoothieServingGrams: number | null;
	sensitiveAcknowledgedAt: string | null;
};

export const getFoodPreferenceProfile = (
	record: FoodPreferenceProfileSource | null | undefined,
): FoodPreferenceProfile | null => {
	if (!record) return null;

	return {
		unitSystem: record.unit_system,
		allergens: [...(record.allergens ?? [])],
		dietaryRestrictions: [...(record.dietary_restrictions ?? [])],
		prioritizedNutrientIds: [...(record.prioritized_nutrient_ids ?? [])],
		defaultSmoothieServingGrams: record.default_smoothie_serving_grams,
		sensitiveAcknowledgedAt: record.sensitive_acknowledged_at,
	};
};

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
