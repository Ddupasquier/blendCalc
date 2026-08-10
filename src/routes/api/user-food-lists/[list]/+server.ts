import {
	annotateFoodsWithFoodSafety,
} from "$lib/server/food-safety/foodSafetyEvaluation.server";
import { LIST_PAGE_LIMITS } from "$lib/config/listPagination";
import { getUserFoodSafetyContext } from "$lib/server/food-safety/userFoodSafety.server";
import {
	appIssueJson,
	requireAppValue,
	throwAppError,
} from "$lib/server/errors/appError.server";
import {
	isIngredientSourceFilter,
	isIngredientTrustFilter,
} from "$lib/utils/ingredients/ingredientProvenance";
import type { FoodListSort } from "$lib/utils/list/listNavigation";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";
import {
	readCloudIngredientListPage,
} from "$lib/server/user-data/foodLists.server";
import {
	enrichFoodForListPlacement,
} from "$lib/server/user-data/foodListPlacement.server";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import type { Json } from "$lib/types/database.types";
import type { FoodItem } from "$lib/utils/food/types";
import { readLimitedJson } from "$lib/server/security/requestBody.server";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const MAXIMUM_BATCH_SIZE = 25;
const FOOD_LIST_WRITE_REQUEST_MAX_BYTES = 2 * 1024 * 1024;
const VALID_SORTS = new Set<FoodListSort>([
	"recent",
	"oldest",
	"name-asc",
	"name-desc",
]);

const getListKey = (value: string): IngredientListKey | null => {
	if (value === "fridge") return MIX_STORAGE_KEYS.fridge;
	if (value === "shopping-list") return MIX_STORAGE_KEYS.shoppingList;
	return null;
};

const getListType = (listKey: IngredientListKey) =>
	listKey === MIX_STORAGE_KEYS.fridge ? "fridge" : "shopping";

const isFood = (value: unknown): value is FoodItem => {
	if (!value || typeof value !== "object") return false;
	const food = value as Partial<FoodItem>;
	return Number.isSafeInteger(food.fdcId) &&
		typeof food.description === "string" &&
		food.description.trim().length > 0 &&
		Array.isArray(food.foodNutrients);
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
		limit > LIST_PAGE_LIMITS.userFoodListRequest ||
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
			readCloudIngredientListPage(
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

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = await locals.getVerifiedUser();
	if (!user) return appIssueJson(401, "AUTH_REQUIRED");
	const listKey = getListKey(params.list);
	if (!listKey) return appIssueJson(404, "RESOURCE_NOT_FOUND");

	const body = await readLimitedJson(
		request,
		FOOD_LIST_WRITE_REQUEST_MAX_BYTES,
	);
	if (!body || typeof body !== "object") {
		return appIssueJson(400, "INVALID_REQUEST");
	}

	const payload = body as {
		food?: unknown;
		foods?: unknown;
		allowMove?: unknown;
	};
	const foods = Array.isArray(payload.foods)
		? payload.foods
		: payload.food
			? [payload.food]
			: [];
	if (
		foods.length === 0 ||
		foods.length > MAXIMUM_BATCH_SIZE ||
		!foods.every(isFood)
	) {
		return appIssueJson(400, "INVALID_REQUEST");
	}

	const enrichedFoods = await Promise.all(
		foods.map((food) => enrichFoodForListPlacement(locals.supabase, food)),
	);
	const listType = getListType(listKey);

	if (payload.food && foods.length === 1) {
		const food = enrichedFoods[0];
		const { data, error } = await locals.supabase.rpc(
			"place_user_food_list_item",
			{
				p_allow_move: payload.allowMove === true,
				p_fdc_id: food.fdcId,
				p_food: food as unknown as Json,
				p_list_type: listType,
			},
		);
		return error
			? appIssueJson(500, "SERVICE_UNAVAILABLE")
			: json({ result: data });
	}

	const { data, error } = await locals.supabase.rpc(
		"place_user_food_list_items",
		{
			p_foods: enrichedFoods as unknown as Json,
			p_list_type: listType,
		},
	);
	return error
		? appIssueJson(500, "SERVICE_UNAVAILABLE")
		: json({ result: data });
};

export const DELETE: RequestHandler = async ({ locals, params, url }) => {
	const user = await locals.getVerifiedUser();
	if (!user) return appIssueJson(401, "AUTH_REQUIRED");
	const listKey = getListKey(params.list);
	if (!listKey) return appIssueJson(404, "RESOURCE_NOT_FOUND");

	const foodId = Number(url.searchParams.get("foodId"));
	if (!Number.isSafeInteger(foodId)) {
		return appIssueJson(400, "INVALID_REQUEST");
	}

	const { data, error } = await locals.supabase.rpc(
		"remove_user_food_list_item",
		{
			p_fdc_id: foodId,
			p_list_type: getListType(listKey),
		},
	);

	return error
		? appIssueJson(500, "SERVICE_UNAVAILABLE")
		: json({ removed: data === true });
};
