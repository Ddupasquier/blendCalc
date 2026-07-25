import { searchApprovedSharedProducts } from "$lib/server/products/catalog.server";
import { searchUserCustomFoods } from "$lib/server/products/customFoods.server";
import { searchUsdaFoods } from "$lib/server/products/usdaCache.server";
import { searchGenericFoods } from "$lib/server/products/genericFoods.server";
import type { FdcFood } from "$lib/utils/food/types";
import {
	mergeIngredientSearchResults,
	sortIngredientSearchResults,
} from "$lib/utils/ingredients/ingredientSearchResults";
import {
	isIngredientSourceFilter,
	isIngredientTrustFilter,
	matchesIngredientProvenance,
} from "$lib/utils/ingredients/ingredientProvenance";
import {
	INGREDIENT_SEARCH_MAX_PAGE_SIZE,
	INGREDIENT_SEARCH_PAGE_SIZE,
	paginateIngredientSearchResults,
} from "$lib/utils/ingredients/ingredientSearchPagination";
import {
	getFoodPreferenceProfile,
	isMissingFoodPreferencesTableError,
} from "$lib/utils/profile/foodPreferenceProfile";
import { annotateFoodWithPreferenceWarnings } from "$lib/utils/profile/foodPreferenceWarnings";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getNutritionCompletenessCatalog } from "$lib/server/nutrition/nutritionCompletenessCatalog.server";
import { getAppReferenceCatalog } from "$lib/server/reference/appReferenceCatalog.server";

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = await locals.getVerifiedUser();
	if (!user) throw error(401, "Sign in to search foods.");

	const query = url.searchParams.get("q")?.trim() ?? "";
	const sourceFilter = url.searchParams.get("source")?.trim() || "all";
	const trustFilter = url.searchParams.get("trust")?.trim() || "any";
	const offset = Number(url.searchParams.get("offset") ?? 0);
	const limit = Number(
		url.searchParams.get("limit") ?? INGREDIENT_SEARCH_PAGE_SIZE,
	);
	if (!Number.isInteger(offset) || offset < 0) {
		throw error(400, "Search offset must be a non-negative whole number.");
	}
	if (
		!Number.isInteger(limit) ||
		limit < 1 ||
		limit > INGREDIENT_SEARCH_MAX_PAGE_SIZE
	) {
		throw error(
			400,
			`Search limit must be between 1 and ${INGREDIENT_SEARCH_MAX_PAGE_SIZE}.`,
		);
	}
	if (query.length < 2) {
		return json({ foods: [], hasMore: false, nextOffset: null, total: 0 });
	}
	if (query.length > 120) throw error(400, "Search is too long.");
	if (!isIngredientSourceFilter(sourceFilter)) {
		throw error(400, "Ingredient source filter is not valid.");
	}
	if (!isIngredientTrustFilter(trustFilter)) {
		throw error(400, "Ingredient review filter is not valid.");
	}

	try {
		const foodPreferencesPromise = locals.supabase
			.from("user_food_preferences")
			.select(
				"unit_system, allergens, dietary_restrictions, prioritized_nutrient_ids, default_smoothie_serving_grams, sensitive_acknowledged_at",
			)
			.eq("user_id", user.id)
			.maybeSingle();
		const searches: Promise<FdcFood[]>[] = [];
		if (trustFilter === "any" || trustFilter === "user-private") {
			searches.push(searchUserCustomFoods(locals.supabase, user.id, query, {
				sourceFilter,
				trustFilter,
			}));
		}
		if (sourceFilter !== "custom" && trustFilter !== "user-private") {
			searches.push(searchApprovedSharedProducts(locals.supabase, query, {
				sourceFilter,
				trustFilter,
			}));
		}
		if (
			(sourceFilter === "all" || sourceFilter === "usda") &&
			(trustFilter === "any" || trustFilter === "source-verified")
		) {
			searches.push(searchUsdaFoods(query));
		}
		if (
			(sourceFilter === "all" || sourceFilter === "national-dataset") &&
			(trustFilter === "any" || trustFilter === "imported")
		) {
			searches.push(searchGenericFoods(locals.supabase, query));
		}
		const searchPromise = Promise.allSettled(searches);
		const [
			foodPreferencesResult,
			searchResults,
			nutritionCompletenessCatalog,
			appReferenceCatalog,
		] = await Promise.all([
			foodPreferencesPromise,
			searchPromise,
			getNutritionCompletenessCatalog(),
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
			appReferenceCatalog.foodCompatibilityMatchRules,
		);
		if (
			searchResults.length > 0 &&
			searchResults.every((result) => result.status === "rejected")
		) {
			throw new Error("Every ingredient search source failed.");
		}
		const resultGroups = searchResults.map((result) =>
			result.status === "fulfilled" ? result.value : [],
		);
		const foods = sortIngredientSearchResults(
			mergeIngredientSearchResults(...resultGroups).filter((food) =>
				matchesIngredientProvenance(food, sourceFilter, trustFilter)
			),
			query,
			profile,
			nutritionCompletenessCatalog,
		);
		const page = paginateIngredientSearchResults(foods, offset, limit);
		return json({
			...page,
			foods: page.foods.map((food) =>
				annotateFoodWithPreferenceWarnings(food, profile)
			),
		});
	} catch {
		throw error(503, "Food search is temporarily unavailable.");
	}
};
