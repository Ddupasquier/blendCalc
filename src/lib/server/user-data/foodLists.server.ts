import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";
import type {
	CloudListSort,
	CloudIngredientListPageOptions,
} from "$lib/utils/storage/supabase/lists";
import {
	CLOUD_CURSOR_PAGE_SIZE,
	type CloudDataContext,
	readAllCursorPages,
	resolveCloudDataContext,
} from "$lib/utils/storage/supabase/shared";
import { hydrateCloudFoodListRows } from "./listHydration.server";

type CloudListType = "fridge" | "shopping";

type CloudListQuery = {
	eq: (column: string, value: string) => CloudListQuery;
	not: (column: string, operator: string, value: null) => CloudListQuery;
	or: (filters: string) => CloudListQuery;
	order: (column: string, options: { ascending: boolean }) => CloudListQuery;
};

const getCloudListType = (key: IngredientListKey): CloudListType =>
	key === MIX_STORAGE_KEYS.fridge ? "fridge" : "shopping";

const applyFoodSearchFilters = <Query extends CloudListQuery>(
	query: Query,
	options: CloudIngredientListPageOptions,
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

export const readCloudIngredientListPage = async (
	key: IngredientListKey,
	options: CloudIngredientListPageOptions,
	context: CloudDataContext,
) => {
	const cloud = await resolveCloudDataContext(context);
	if (!cloud) return null;
	const { supabase, userId } = cloud;

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

	const foods = await hydrateCloudFoodListRows(supabase, data);
	return {
		foods,
		totalCount: count ?? foods.length,
	};
};

export const readCloudIngredientListFood = async (
	key: IngredientListKey,
	foodId: number,
	context: CloudDataContext,
) => {
	const cloud = await resolveCloudDataContext(context);
	if (!cloud) return null;
	const { supabase, userId } = cloud;

	const { data, error } = await supabase
		.from("user_food_list_items")
		.select(
			"id, food, created_at, shared_product_id, shared_product_submission_id, source_key, trust_status",
		)
		.eq("user_id", userId)
		.eq("list_type", getCloudListType(key))
		.eq("fdc_id", foodId)
		.limit(1);
	if (error) throw error;
	if (!data?.length) return null;

	return (await hydrateCloudFoodListRows(supabase, data))[0] ?? null;
};

export const readCloudIngredientList = async (
	key: IngredientListKey,
	context: CloudDataContext,
) => {
	const cloud = await resolveCloudDataContext(context);
	if (!cloud) return null;
	const { supabase, userId } = cloud;

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

	return hydrateCloudFoodListRows(supabase, rows);
};
