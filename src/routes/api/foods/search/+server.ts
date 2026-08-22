import { searchApprovedSharedProducts } from "$lib/server/products/catalog.server";
import { searchUserCustomFoods } from "$lib/server/products/customFoods.server";
import { areExternalProductLookupsEnabled } from "$lib/server/products/externalProductPolicy.server";
import { searchUsdaFoods } from "$lib/server/products/usdaCache.server";
import { searchGenericFoods } from "$lib/server/products/genericFoods.server";
import type { FoodItem } from "$lib/utils/food/types";
import {
	isUsableIngredientSearchResult,
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
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getNutritionCompletenessCatalog } from "$lib/server/nutrition/nutritionCompletenessCatalog.server";
import { getUserFoodSafetyContext } from "$lib/server/food-safety/userFoodSafety.server";
import { annotateFoodsWithFoodSafety } from "$lib/server/food-safety/foodSafetyEvaluation.server";
import {
	requireAppValue,
	throwAppError,
} from "$lib/server/errors/appError.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { hydrateFoodsWithCachedImages } from "$lib/utils/storage/supabase/foodImages";

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = requireAppValue(
		await locals.getVerifiedUser(),
		401,
		"AUTH_REQUIRED",
	);

	const query = url.searchParams.get("q")?.trim() ?? "";
	const sourceFilter = url.searchParams.get("source")?.trim() || "all";
	const trustFilter = url.searchParams.get("trust")?.trim() || "any";
	const offset = Number(url.searchParams.get("offset") ?? 0);
	const limit = Number(
		url.searchParams.get("limit") ?? INGREDIENT_SEARCH_PAGE_SIZE,
	);
	if (!Number.isInteger(offset) || offset < 0) {
		throwAppError(400, "SEARCH_PAGINATION_INVALID");
	}
	if (
		!Number.isInteger(limit) ||
		limit < 1 ||
		limit > INGREDIENT_SEARCH_MAX_PAGE_SIZE
	) {
		throwAppError(400, "SEARCH_PAGINATION_INVALID");
	}
	if (query.length < 2) {
		return json({ foods: [], hasMore: false, nextOffset: null, total: 0 });
	}
	if (query.length > 120) {
		throwAppError(400, "SEARCH_QUERY_TOO_LONG", { maximum: 120 });
	}
	if (!isIngredientSourceFilter(sourceFilter)) {
		throwAppError(400, "SEARCH_FILTER_INVALID");
	}
	if (!isIngredientTrustFilter(trustFilter)) {
		throwAppError(400, "SEARCH_FILTER_INVALID");
	}

	try {
		const searches: Promise<FoodItem[]>[] = [];
		const catalogClient = getSupabaseAdminClient();
		if (trustFilter === "any" || trustFilter === "user-private") {
			searches.push(searchUserCustomFoods(locals.supabase, user.id, query, {
				sourceFilter,
				trustFilter,
			}));
		}
		if (sourceFilter !== "custom" && trustFilter !== "user-private") {
			searches.push(searchApprovedSharedProducts(catalogClient, query, {
				sourceFilter,
				trustFilter,
			}));
		}
		if (
			areExternalProductLookupsEnabled() &&
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
			searchResults,
			nutritionCompletenessCatalog,
			foodSafetyContext,
		] = await Promise.all([
			searchPromise,
			getNutritionCompletenessCatalog(),
			getUserFoodSafetyContext(locals.supabase, user.id),
		]);
		if (
			searchResults.length > 0 &&
			searchResults.every((result) => result.status === "rejected")
		) {
			throw new Error("Every ingredient search source failed.");
		}
		const resultGroups = searchResults.map((result) =>
			result.status === "fulfilled" ? result.value : [],
		);
		const mergedFoods = mergeIngredientSearchResults(...resultGroups).filter(
			(food) =>
				isUsableIngredientSearchResult(food) &&
				matchesIngredientProvenance(food, sourceFilter, trustFilter),
		);
		const foodsWithSafetyEvaluation = annotateFoodsWithFoodSafety(
			mergedFoods,
			foodSafetyContext,
		);
		const foods = sortIngredientSearchResults(
			foodsWithSafetyEvaluation,
			query,
			nutritionCompletenessCatalog,
		);
		const page = paginateIngredientSearchResults(foods, offset, limit);
		const visibleFoodsWithCurrentImages = await hydrateFoodsWithCachedImages(
			catalogClient,
			page.foods,
		);
		return json({ ...page, foods: visibleFoodsWithCurrentImages });
	} catch {
		return throwAppError(503, "FOOD_SEARCH_UNAVAILABLE");
	}
};
