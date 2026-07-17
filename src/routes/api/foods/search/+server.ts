import { searchApprovedSharedProducts } from "$lib/server/products/catalog.server";
import { searchUserCustomFoods } from "$lib/server/products/customFoods.server";
import { searchUsdaFoods } from "$lib/server/products/usdaCache.server";
import {
	mergeIngredientSearchResults,
	sortIngredientSearchResults,
} from "$lib/utils/ingredients/ingredientSearchResults";
import {
	getFoodPreferenceProfile,
	isMissingFoodPreferencesTableError,
} from "$lib/utils/profile/foodPreferenceProfile";
import { annotateFoodWithPreferenceWarnings } from "$lib/utils/profile/foodPreferenceWarnings";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const SEARCH_RESULT_LIMIT = 50;

export const GET: RequestHandler = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) throw error(401, "Sign in to search foods.");

	const query = url.searchParams.get("q")?.trim() ?? "";
	if (query.length < 2) return json({ foods: [] });
	if (query.length > 120) throw error(400, "Search is too long.");

	try {
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
		const searchResults = await Promise.allSettled([
			searchUserCustomFoods(locals.supabase, user.id, query),
			searchApprovedSharedProducts(locals.supabase, query),
			searchUsdaFoods(query),
		]);
		if (searchResults.every((result) => result.status === "rejected")) {
			throw new Error("Every ingredient search source failed.");
		}
		const resultGroups = searchResults.map((result) =>
			result.status === "fulfilled" ? result.value : [],
		);
		const foods = sortIngredientSearchResults(
			mergeIngredientSearchResults(...resultGroups),
			query,
			profile,
		).slice(0, SEARCH_RESULT_LIMIT);
		return json({
			foods: foods.map((food) => annotateFoodWithPreferenceWarnings(food, profile)),
		});
	} catch {
		throw error(503, "Food search is temporarily unavailable.");
	}
};
