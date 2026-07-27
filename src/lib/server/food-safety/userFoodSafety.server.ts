import type { Database } from "$lib/types/database.types";
import type { FdcFood } from "$lib/utils/food/types";
import {
	getFoodPreferenceProfile,
	isMissingFoodPreferencesTableError,
} from "$lib/utils/profile/foodPreferenceProfile";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	annotateFoodsWithFoodSafety,
	type FoodSafetyEvaluationContext,
} from "./foodSafetyEvaluation.server";
import { getFoodSafetyPolicy } from "./foodSafetyPolicy.server";

export const getUserFoodSafetyContext = async (
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<FoodSafetyEvaluationContext> => {
	const [preferencesResult, policy] = await Promise.all([
		supabase
			.from("user_food_preferences")
			.select(
				"unit_system, allergens, dietary_restrictions, prioritized_nutrient_ids, default_smoothie_serving_grams, sensitive_acknowledged_at",
			)
			.eq("user_id", userId)
			.maybeSingle(),
		getFoodSafetyPolicy(),
	]);

	if (
		preferencesResult.error &&
		!isMissingFoodPreferencesTableError(preferencesResult.error)
	) {
		throw preferencesResult.error;
	}

	return {
		profile: getFoodPreferenceProfile(preferencesResult.data),
		policy,
	};
};

export const annotateFoodsForUser = async (
	supabase: SupabaseClient<Database>,
	userId: string,
	foods: FdcFood[],
) => annotateFoodsWithFoodSafety(
	foods,
	await getUserFoodSafetyContext(supabase, userId),
);
