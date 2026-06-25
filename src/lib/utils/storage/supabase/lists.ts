import { MIX_STORAGE_KEYS } from "../../../../defaults/mixDefaults";
import { getSupabaseBrowserClient } from "$lib/supabase/client";
import { compactFood, uniqueFoodsById } from "$lib/utils/food/foodRecords";
import { hydrateFoodWithNormalizedNutrients } from "$lib/utils/food/normalizedNutrients";
import type { FdcFood } from "$lib/utils/food/types";
import type { SmoothieListKey } from "$lib/utils/storage/smoothieLists";
import { readNormalizedNutrientsByParent } from "./normalizedNutrients";
import {
	CLOUD_CURSOR_PAGE_SIZE,
	getCurrentUserId,
	readAllCursorPages,
	toJson,
} from "./shared";

type CloudListType = "fridge" | "shopping";

const getCloudListType = (key: SmoothieListKey): CloudListType => {
	return key === MIX_STORAGE_KEYS.fridge ? "fridge" : "shopping";
};

type CloudListSort = "recent" | "name-asc" | "name-desc";

type CloudSmoothieListPageOptions = {
	limit: number;
	offset?: number;
	query?: string;
	sort?: CloudListSort;
	sourceFilter?: string;
};

type CloudListQuery = {
	eq: (column: string, value: string) => CloudListQuery;
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

	if (options.sourceFilter === "custom") {
		nextQuery = nextQuery.eq("food->>customFood", "true");
	}

	if (options.sourceFilter === "fdc") {
		nextQuery = nextQuery.or(
			"food->>customFood.is.null,food->>customFood.eq.false",
		);
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
		.select("id, food, created_at", { count: "exact" })
		.eq("user_id", userId)
		.eq("list_type", getCloudListType(key));

	query = applyFoodSearchFilters(query, options);
	query = applyFoodSort(query, options.sort);

	const { data, count, error } = await query.range(offset, offset + limit - 1);
	if (error || !data) return null;

	const normalizedRows = await readNormalizedNutrientsByParent(
		supabase,
		"user_food_list_item_id",
		data.map((row) => row.id),
	);
	const foods = data.map((row) => {
		const food = row.food as unknown as FdcFood;
		return hydrateFoodWithNormalizedNutrients(
			{
				...food,
				listAddedAt: food.listAddedAt ?? new Date(row.created_at).getTime(),
			},
			normalizedRows?.get(row.id),
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
			.select("id, food, created_at")
			.eq("user_id", userId)
			.eq("list_type", getCloudListType(key))
			.order("id", { ascending: true })
			.limit(CLOUD_CURSOR_PAGE_SIZE);

		if (cursorId) query = query.gt("id", cursorId);
		return await query;
	});

	if (!rows) return null;
	const normalizedRows = await readNormalizedNutrientsByParent(
		supabase,
		"user_food_list_item_id",
		rows.map((row) => row.id),
	);
	return rows
		.map((row) => {
			const food = row.food as unknown as FdcFood;
			return hydrateFoodWithNormalizedNutrients(
				{
					...food,
					listAddedAt: food.listAddedAt ?? new Date(row.created_at).getTime(),
				},
				normalizedRows?.get(row.id),
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
		uniqueFoodsById(foods).map((food) => ({
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
