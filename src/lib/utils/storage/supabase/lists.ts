import { MIX_STORAGE_KEYS } from "../../../../defaults/mixDefaults";
import { getSupabaseBrowserClient } from "$lib/supabase/client";
import { compactFood, uniqueFoodsById } from "$lib/utils/food/records/foodRecords";
import { uniqueFoodsByIdentity } from "$lib/utils/food/records/foodIdentity";
import { hydrateFoodWithNormalizedNutrients } from "$lib/utils/food/nutrients/normalizedNutrients";
import { hydrateFoodWithNormalizedServings } from "$lib/utils/food/servings/normalizedServings";
import type { FdcFood } from "$lib/utils/food/types";
import { hydrateFoodWithCatalogState } from "$lib/utils/ingredients/ingredientCatalogState";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
import { hydrateFoodsWithCachedImages } from "./foodImages";
import { readNormalizedNutrientsByParent } from "./normalizedNutrients";
import { readFoodServingsByParent } from "./servings";
import {
	CLOUD_CURSOR_PAGE_SIZE,
	getCurrentUserId,
	readAllCursorPages,
	toJson,
} from "./shared";

type CloudListType = "fridge" | "shopping";

export type CloudListPlacementResult =
	| "added"
	| "duplicate"
	| "moved"
	| "move-required:fridge"
	| "move-required:shopping"
	| "error";

const getCloudListType = (key: SmoothieListKey): CloudListType => {
	return key === MIX_STORAGE_KEYS.fridge ? "fridge" : "shopping";
};

type CloudListSort = "recent" | "oldest" | "name-asc" | "name-desc";

type CloudSmoothieListPageOptions = {
	limit: number;
	offset?: number;
	query?: string;
	sort?: CloudListSort;
	sourceFilter?: string;
	trustFilter?: string;
};

type CloudListQuery = {
	eq: (column: string, value: string) => CloudListQuery;
	is: (column: string, value: null) => CloudListQuery;
	not: (column: string, operator: string, value: null) => CloudListQuery;
	or: (filters: string) => CloudListQuery;
	order: (column: string, options: { ascending: boolean }) => CloudListQuery;
};

const applyFoodSearchFilters = <Query extends CloudListQuery>(
	query: Query,
	options: CloudSmoothieListPageOptions,
) => {
	let nextQuery: CloudListQuery = query;
	const terms = options.query?.trim().split(/\s+/).filter(Boolean) ?? [];

	for (const term of terms) {
		nextQuery = nextQuery.or(
			[
				`food->>description.ilike.%${term}%`,
				`food->>brandOwner.ilike.%${term}%`,
				`food->>foodCategory.ilike.%${term}%`,
			].join(","),
		);
	}

	if (options.sourceFilter && options.sourceFilter !== "all") {
		nextQuery = nextQuery.eq("source_key", options.sourceFilter);
	}

	if (options.trustFilter && options.trustFilter !== "any") {
		nextQuery = nextQuery.eq("trust_status", options.trustFilter);
	}

	return nextQuery as Query;
};

const applyFoodSort = <Query extends CloudListQuery>(
	query: Query,
	sort: CloudListSort = "recent",
) => {
	if (sort === "name-asc") {
		return query.order("food->>description", { ascending: true }) as Query;
	}

	if (sort === "name-desc") {
		return query.order("food->>description", { ascending: false }) as Query;
	}

	if (sort === "oldest") {
		return query
			.order("created_at", { ascending: true })
			.order("id", { ascending: true }) as Query;
	}

	return query
		.order("created_at", { ascending: false })
		.order("id", { ascending: false }) as Query;
};

export const readCloudSmoothieListPage = async (
	key: SmoothieListKey,
	options: CloudSmoothieListPageOptions,
) => {
	const userId = await getCurrentUserId();
	if (!userId) return null;
	const supabase = getSupabaseBrowserClient();
	if (!supabase) return null;

	const limit = Math.max(1, options.limit);
	const offset = Math.max(0, options.offset ?? 0);
	let query = supabase
		.from("user_food_list_items")
		.select(
			"id, food, created_at, shared_product_id, shared_product_submission_id, source_key, trust_status",
			{ count: "exact" },
		)
		.eq("user_id", userId)
		.eq("list_type", getCloudListType(key));

	query = applyFoodSearchFilters(query, options);
	query = applyFoodSort(query, options.sort);

	const { data, count, error } = await query.range(offset, offset + limit - 1);
	if (error) throw error;
	if (!data) throw new Error("Ingredient list could not be loaded.");

	const baseFoods = data.map((row) =>
		hydrateFoodWithCatalogState(
			{
				...(row.food as unknown as FdcFood),
				listAddedAt:
					(row.food as unknown as FdcFood).listAddedAt ??
					new Date(row.created_at).getTime(),
			},
			row,
		),
	);
	const [normalizedRows, servingRows, foodsWithImages] = await Promise.all([
		readNormalizedNutrientsByParent(
			supabase,
			"user_food_list_item_id",
			data.map((row) => row.id),
		),
		readFoodServingsByParent(
			supabase,
			"user_food_list_item_id",
			data.map((row) => row.id),
		),
		hydrateFoodsWithCachedImages(supabase, baseFoods),
	]);
	const foods = foodsWithImages.map((food, index) => {
		const row = data[index];
		const foodWithNutrients = hydrateFoodWithNormalizedNutrients(
			food,
			normalizedRows.get(row.id) ?? [],
		);
		return hydrateFoodWithNormalizedServings(
			foodWithNutrients,
			servingRows.get(row.id) ?? [],
		);
	});

	return {
		foods,
		totalCount: count ?? foods.length,
	};
};

export const readCloudSmoothieList = async (key: SmoothieListKey) => {
	const userId = await getCurrentUserId();
	if (!userId) return null;
	const supabase = getSupabaseBrowserClient();
	if (!supabase) return null;

	const rows = await readAllCursorPages(async (cursorId) => {
		let query = supabase
			.from("user_food_list_items")
			.select(
				"id, food, created_at, shared_product_id, shared_product_submission_id, source_key, trust_status",
			)
			.eq("user_id", userId)
			.eq("list_type", getCloudListType(key))
			.order("id", { ascending: true })
			.limit(CLOUD_CURSOR_PAGE_SIZE);

		if (cursorId) query = query.gt("id", cursorId);
		return await query;
	});

	const baseFoods = rows.map((row) =>
		hydrateFoodWithCatalogState(
			{
				...(row.food as unknown as FdcFood),
				listAddedAt:
					(row.food as unknown as FdcFood).listAddedAt ??
					new Date(row.created_at).getTime(),
			},
			row,
		),
	);
	const [normalizedRows, servingRows, foodsWithImages] = await Promise.all([
		readNormalizedNutrientsByParent(
			supabase,
			"user_food_list_item_id",
			rows.map((row) => row.id),
		),
		readFoodServingsByParent(
			supabase,
			"user_food_list_item_id",
			rows.map((row) => row.id),
		),
		hydrateFoodsWithCachedImages(supabase, baseFoods),
	]);
	return foodsWithImages.map((food, index) => {
		const row = rows[index];
		const foodWithNutrients = hydrateFoodWithNormalizedNutrients(
			food,
			normalizedRows.get(row.id) ?? [],
		);
		return hydrateFoodWithNormalizedServings(
			foodWithNutrients,
			servingRows.get(row.id) ?? [],
		);
	});
};

export const writeCloudSmoothieList = async (
	key: SmoothieListKey,
	foods: FdcFood[],
) => {
	const userId = await getCurrentUserId();
	if (!userId) return false;
	const supabase = getSupabaseBrowserClient();
	if (!supabase) return false;

	const listType = getCloudListType(key);
	if (foods.length === 0) return true;

	const { error } = await supabase.from("user_food_list_items").upsert(
			uniqueFoodsByIdentity(uniqueFoodsById(foods)).map((food) => ({
			user_id: userId,
			list_type: listType,
			fdc_id: food.fdcId,
			food: toJson(compactFood(food)),
		})),
		{ onConflict: "user_id,list_type,fdc_id" },
	);

	return !error;
};

export const upsertCloudSmoothieListItem = async (
	key: SmoothieListKey,
	food: FdcFood,
) => {
	const userId = await getCurrentUserId();
	if (!userId) return false;
	const supabase = getSupabaseBrowserClient();
	if (!supabase) return false;

	const { error } = await supabase.from("user_food_list_items").upsert(
		{
			user_id: userId,
			list_type: getCloudListType(key),
			fdc_id: food.fdcId,
			food: toJson(compactFood(food)),
		},
		{ onConflict: "user_id,list_type,fdc_id" },
	);

	return !error;
};

export const placeCloudSmoothieListItem = async (
	key: SmoothieListKey,
	food: FdcFood,
	allowMove = false,
): Promise<CloudListPlacementResult> => {
	const userId = await getCurrentUserId();
	if (!userId) return "error";
	const supabase = getSupabaseBrowserClient();
	if (!supabase) return "error";

	const { data, error } = await supabase.rpc("place_user_food_list_item", {
		p_allow_move: allowMove,
		p_fdc_id: food.fdcId,
		p_food: toJson(compactFood(food)),
		p_list_type: getCloudListType(key),
	});

	if (error) return "error";
	if (
		data === "added" ||
		data === "duplicate" ||
		data === "moved" ||
		data === "move-required:fridge" ||
		data === "move-required:shopping"
	) {
		return data;
	}

	return "error";
};

export const removeCloudSmoothieListItem = async (
	key: SmoothieListKey,
	foodId: number,
) => {
	const userId = await getCurrentUserId();
	if (!userId) return false;
	const supabase = getSupabaseBrowserClient();
	if (!supabase) return false;

	const { error } = await supabase
		.from("user_food_list_items")
		.delete()
		.eq("user_id", userId)
		.eq("list_type", getCloudListType(key))
		.eq("fdc_id", foodId);

	return !error;
};

export const reconcileCloudSmoothieList = async (
	key: SmoothieListKey,
	localFoods: FdcFood[],
) => {
	const cloudFoods = await readCloudSmoothieList(key);
	if (!cloudFoods) return localFoods;
	return cloudFoods;
};
