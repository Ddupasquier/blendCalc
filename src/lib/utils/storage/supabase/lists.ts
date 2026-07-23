import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import { compactFood, uniqueFoodsById } from "$lib/utils/food/records/foodRecords";
import { uniqueFoodsByIdentity } from "$lib/utils/food/records/foodIdentity";
import type { FdcFood } from "$lib/utils/food/types";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
import { hydrateCloudFoodListRows } from "./listHydration";
import {
	CLOUD_CURSOR_PAGE_SIZE,
	type CloudDataContext,
	readAllCursorPages,
	resolveCloudClient,
	resolveCloudDataContext,
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

export type CloudListRenameResult =
	| "renamed"
	| "duplicate"
	| "missing"
	| "unchanged"
	| "invalid"
	| "error";

export type CloudSmoothieListIndex = Record<
	SmoothieListKey,
	{
		foodIds: number[];
		foodIdentityKeys: string[];
	}
>;

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
	context?: CloudDataContext,
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

export const readCloudSmoothieList = async (
	key: SmoothieListKey,
	context?: CloudDataContext,
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

export const readCloudSmoothieListIndex = async (
	context?: CloudDataContext,
): Promise<CloudSmoothieListIndex | null> => {
	const cloud = await resolveCloudDataContext(context);
	if (!cloud) return null;
	const { supabase, userId } = cloud;

	const rows = await readAllCursorPages(async (cursorId) => {
		let query = supabase
			.from("user_food_list_items")
			.select("id, list_type, fdc_id, food_identity_key")
			.eq("user_id", userId)
			.order("id", { ascending: true })
			.limit(CLOUD_CURSOR_PAGE_SIZE);

		if (cursorId) query = query.gt("id", cursorId);
		return await query;
	});

	const index: CloudSmoothieListIndex = {
		[MIX_STORAGE_KEYS.fridge]: { foodIds: [], foodIdentityKeys: [] },
		[MIX_STORAGE_KEYS.shoppingList]: { foodIds: [], foodIdentityKeys: [] },
	};

	for (const row of rows) {
		const key = row.list_type === "fridge"
			? MIX_STORAGE_KEYS.fridge
			: MIX_STORAGE_KEYS.shoppingList;
		index[key].foodIds.push(Number(row.fdc_id));
		index[key].foodIdentityKeys.push(
			row.food_identity_key ?? `fdc:${row.fdc_id}`,
		);
	}

	return index;
};

export const writeCloudSmoothieList = async (
	key: SmoothieListKey,
	foods: FdcFood[],
	context?: CloudDataContext,
) => {
	const supabase = resolveCloudClient(context);
	if (!supabase) return false;

	const listType = getCloudListType(key);
	if (foods.length === 0) return true;

	const { data, error } = await supabase.rpc("place_user_food_list_items", {
		p_list_type: listType,
		p_foods: toJson(
			uniqueFoodsByIdentity(uniqueFoodsById(foods)).map((food) =>
				compactFood(food),
			),
		),
	});

	return !error && (data === "added" || data === "duplicate");
};

export const renameCloudSmoothieListItem = async (
	key: SmoothieListKey,
	foodId: number,
	description: string,
	context?: CloudDataContext,
): Promise<CloudListRenameResult> => {
	const supabase = resolveCloudClient(context);
	if (!supabase) return "error";

	const { data, error } = await supabase.rpc("rename_user_food_list_item", {
		p_description: description,
		p_fdc_id: foodId,
		p_list_type: getCloudListType(key),
	});
	if (error) return "error";
	if (
		data === "renamed" ||
		data === "duplicate" ||
		data === "missing" ||
		data === "unchanged" ||
		data === "invalid"
	) {
		return data;
	}

	return "error";
};

export const placeCloudSmoothieListItem = async (
	key: SmoothieListKey,
	food: FdcFood,
	allowMove = false,
	context?: CloudDataContext,
): Promise<CloudListPlacementResult> => {
	const supabase = resolveCloudClient(context);
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

export const moveCloudSmoothieListItems = async (
	sourceKey: SmoothieListKey,
	targetKey: SmoothieListKey,
	foodIds: number[],
	context?: CloudDataContext,
) => {
	const supabase = resolveCloudClient(context);
	if (!supabase) return false;

	const uniqueFoodIds = [...new Set(foodIds)].filter(Number.isSafeInteger);
	if (uniqueFoodIds.length === 0 || sourceKey === targetKey) return false;

	const { data, error } = await supabase.rpc("move_user_food_list_items", {
		p_source_list_type: getCloudListType(sourceKey),
		p_target_list_type: getCloudListType(targetKey),
		p_fdc_ids: uniqueFoodIds,
	});

	return !error && data === uniqueFoodIds.length;
};

export const removeCloudSmoothieListItem = async (
	key: SmoothieListKey,
	foodId: number,
	context?: CloudDataContext,
) => {
	const supabase = resolveCloudClient(context);
	if (!supabase) return false;

	const { data, error } = await supabase.rpc("remove_user_food_list_item", {
		p_fdc_id: foodId,
		p_list_type: getCloudListType(key),
	});

	return !error && data === true;
};
