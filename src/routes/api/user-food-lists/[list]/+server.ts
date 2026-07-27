import {
	annotateFoodsWithFoodSafety,
} from "$lib/server/food-safety/foodSafetyEvaluation.server";
import { getUserFoodSafetyContext } from "$lib/server/food-safety/userFoodSafety.server";
import {
	requireAppValue,
	throwAppError,
} from "$lib/server/errors/appError.server";
import {
	isIngredientSourceFilter,
	isIngredientTrustFilter,
} from "$lib/utils/ingredients/ingredientProvenance";
import type { FoodListSort } from "$lib/utils/list/listNavigation";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
import {
	readCloudSmoothieListPage,
} from "$lib/server/user-data/foodLists.server";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const MAXIMUM_PAGE_SIZE = 100;
const VALID_SORTS = new Set<FoodListSort>([
	"recent",
	"oldest",
	"name-asc",
	"name-desc",
]);

const getListKey = (value: string): SmoothieListKey | null => {
	if (value === "fridge") return MIX_STORAGE_KEYS.fridge;
	if (value === "shopping-list") return MIX_STORAGE_KEYS.shoppingList;
	return null;
};

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const user = requireAppValue(
		await locals.getVerifiedUser(),
		401,
		"AUTH_REQUIRED",
	);
	const listKey = requireAppValue(
		getListKey(params.list),
		404,
		"RESOURCE_NOT_FOUND",
	);

	const limit = Number(url.searchParams.get("limit") ?? 15);
	const offset = Number(url.searchParams.get("offset") ?? 0);
	const query = url.searchParams.get("q")?.trim() ?? "";
	const sort = (url.searchParams.get("sort") ?? "recent") as FoodListSort;
	const sourceFilter = url.searchParams.get("source")?.trim() || "all";
	const trustFilter = url.searchParams.get("trust")?.trim() || "any";

	if (
		!Number.isInteger(limit) ||
		limit < 1 ||
		limit > MAXIMUM_PAGE_SIZE ||
		!Number.isInteger(offset) ||
		offset < 0
	) {
		throwAppError(400, "SEARCH_PAGINATION_INVALID");
	}
	if (query.length > 120) {
		throwAppError(400, "SEARCH_QUERY_TOO_LONG", { maximum: 120 });
	}
	if (
		!VALID_SORTS.has(sort) ||
		!isIngredientSourceFilter(sourceFilter) ||
		!isIngredientTrustFilter(trustFilter)
	) {
		throwAppError(400, "SEARCH_FILTER_INVALID");
	}

	try {
		const [page, foodSafetyContext] = await Promise.all([
			readCloudSmoothieListPage(
				listKey,
				{
					limit,
					offset,
					query,
					sort,
					sourceFilter,
					trustFilter,
				},
				{ supabase: locals.supabase, userId: user.id },
			),
			getUserFoodSafetyContext(locals.supabase, user.id),
		]);
		if (!page) throw new Error("User food list was unavailable.");

		return json({
			...page,
			foods: annotateFoodsWithFoodSafety(
				page.foods,
				foodSafetyContext,
			),
		});
	} catch {
		return throwAppError(503, "SERVICE_UNAVAILABLE");
	}
};
