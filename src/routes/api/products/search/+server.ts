import { searchApprovedSharedProducts } from "$lib/server/products/catalog.server";
import {
	getFoodPreferenceProfile,
	isMissingFoodPreferencesTableError,
} from "$lib/utils/profile/foodPreferenceProfile";
import { annotateFoodWithPreferenceWarnings } from "$lib/utils/profile/foodPreferenceWarnings";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getAppReferenceCatalog } from "$lib/server/reference/appReferenceCatalog.server";

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = await locals.getVerifiedUser();
	if (!user) throw error(401, "Sign in to search shared products.");

	const query = url.searchParams.get("q")?.trim() ?? "";
	if (query.length < 2) return json({ foods: [] });
	const [foods, foodPreferencesResult, appReferenceCatalog] = await Promise.all([
		searchApprovedSharedProducts(locals.supabase, query),
		locals.supabase
			.from("user_food_preferences")
			.select(
				"unit_system, allergens, dietary_restrictions, prioritized_nutrient_ids, default_smoothie_serving_grams, sensitive_acknowledged_at",
			)
			.eq("user_id", user.id)
			.maybeSingle(),
		getAppReferenceCatalog(),
	]);
	if (
		foodPreferencesResult.error &&
		!isMissingFoodPreferencesTableError(foodPreferencesResult.error)
	) {
		throw foodPreferencesResult.error;
	}
	const profile = getFoodPreferenceProfile(
		foodPreferencesResult.data,
		appReferenceCatalog.foodPreferenceConflictRules,
	);
	return json({
		foods: foods.map((food) => annotateFoodWithPreferenceWarnings(food, profile)),
	});
};
