import { searchApprovedSharedProducts } from "$lib/server/products/catalog.server";
import {
	getFoodPreferenceProfile,
	isMissingFoodPreferencesTableError,
} from "$lib/utils/profile/foodPreferenceProfile";
import { annotateFoodWithPreferenceWarnings } from "$lib/utils/profile/foodPreferenceWarnings";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) throw error(401, "Sign in to search shared products.");

	const query = url.searchParams.get("q")?.trim() ?? "";
	if (query.length < 2) return json({ foods: [] });
	const foods = await searchApprovedSharedProducts(locals.supabase, query);
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
};
