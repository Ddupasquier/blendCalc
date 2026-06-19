import type { Database } from "$lib/types/database.types";

export type FoodPreferenceRecord =
	Database["public"]["Tables"]["user_food_preferences"]["Row"];

export type FoodPreferenceProfile = {
	unitSystem: FoodPreferenceRecord["unit_system"];
	dislikes: string[];
	allergens: string[];
	dietaryRestrictions: string[];
	ingredientsToAvoid: string[];
	prioritizedNutrientIds: number[];
	defaultSmoothieServingGrams: number | null;
	sensitiveAcknowledgedAt: string | null;
};

export const getFoodPreferenceProfile = (
	record: FoodPreferenceRecord | null | undefined,
): FoodPreferenceProfile | null => {
	if (!record) return null;

	return {
		unitSystem: record.unit_system,
		dislikes: [...(record.food_preferences ?? [])],
		allergens: [...(record.allergens ?? [])],
		dietaryRestrictions: [...(record.dietary_restrictions ?? [])],
		ingredientsToAvoid: [...(record.ingredients_to_avoid ?? [])],
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
