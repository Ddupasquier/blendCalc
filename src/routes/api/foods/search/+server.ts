import { searchUsdaFoods } from "$lib/server/products/usdaCache.server";
import {
	getFoodPreferenceProfile,
	isMissingFoodPreferencesTableError,
} from "$lib/utils/profile/foodPreferenceProfile";
import { annotateFoodWithPreferenceWarnings } from "$lib/utils/profile/foodPreferenceWarnings";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) throw error(401, "Sign in to search foods.");

	const query = url.searchParams.get("q")?.trim() ?? "";
	if (query.length < 2) return json({ foods: [] });
	if (query.length > 120) throw error(400, "Search is too long.");

	try {
		const foods = await searchUsdaFoods(query);
		const foodPreferencesResult = await locals.supabase
			.from("user_food_preferences")
			.select("*")
			.eq("user_id", user.id)
			.maybeSingle();
		if (
			foodPreferencesResult.error &&
			!isMissingFoodPreferencesTableError(foodPreferencesResult.error)
		) {
			throw foodPreferencesResult.error;
		}
		const profile = getFoodPreferenceProfile(foodPreferencesResult.data);
		return json({
			foods: foods.map((food) => annotateFoodWithPreferenceWarnings(food, profile)),
		});
	} catch {
		throw error(503, "Food search is temporarily unavailable.");
	}
};
