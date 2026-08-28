import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import {
	normalizeFoodForStorage,
	deduplicateFoodItemsByApplicationId,
} from "$lib/utils/food/records/foodRecords";
import { deduplicateFoodItemsByIdentity } from "$lib/utils/food/records/foodIdentity";
import type { FoodItem } from "$lib/utils/food/types";
import type { FoodSafetyFilter } from "$lib/utils/food/safety/foodSafetyFilters";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";
import {
	CLOUD_CURSOR_PAGE_SIZE,
	type CloudDataContext,
	readAllCursorPages,
	resolveCloudClient,
	resolveCloudDataContext,
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
	"renamed" | "duplicate" | "missing" | "unchanged" | "invalid" | "error";

export type CloudIngredientListIndex = Record<
	IngredientListKey,
	{
		foodIds: number[];
		foodIdentityKeys: string[];
	}
>;

const getCloudListType = (key: IngredientListKey): CloudListType => {
	return key === MIX_STORAGE_KEYS.fridge ? "fridge" : "shopping";
};

const getCloudListApiPath = (key: IngredientListKey) =>
	key === MIX_STORAGE_KEYS.fridge
		? "/api/user-food-lists/fridge"
		: "/api/user-food-lists/shopping-list";

const placeFoodsThroughServer = async (
	key: IngredientListKey,
	body: Record<string, unknown>,
) => {
	try {
		const response = await fetch(getCloudListApiPath(key), {
			method: "POST",
			headers: {
				accept: "application/json",
				"content-type": "application/json",
			},
			body: JSON.stringify(body),
		});
		if (!response.ok) return null;
		const payload = (await response.json()) as { result?: unknown };
		return payload.result;
	} catch {
		return null;
	}
};

export type CloudListSort = "recent" | "oldest" | "name-asc" | "name-desc";

export type CloudIngredientListPageOptions = {
	limit: number;
	offset?: number;
	query?: string;
	sort?: CloudListSort;
	sourceFilter?: string;
	trustFilter?: string;
	safetyFilter?: FoodSafetyFilter;
};

export const readCloudIngredientListIndex = async (
	context?: CloudDataContext,
): Promise<CloudIngredientListIndex | null> => {
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

	const index: CloudIngredientListIndex = {
		[MIX_STORAGE_KEYS.fridge]: { foodIds: [], foodIdentityKeys: [] },
		[MIX_STORAGE_KEYS.shoppingList]: { foodIds: [], foodIdentityKeys: [] },
	};

	for (const row of rows) {
		const key =
			row.list_type === "fridge"
				? MIX_STORAGE_KEYS.fridge
				: MIX_STORAGE_KEYS.shoppingList;
		index[key].foodIds.push(Number(row.fdc_id));
		index[key].foodIdentityKeys.push(
			row.food_identity_key ?? `fdc:${row.fdc_id}`,
		);
	}

	return index;
};

export const writeCloudIngredientList = async (
	key: IngredientListKey,
	foods: FoodItem[],
	_context?: CloudDataContext,
) => {
	if (foods.length === 0) return true;

	const result = await placeFoodsThroughServer(key, {
		foods: deduplicateFoodItemsByIdentity(
			deduplicateFoodItemsByApplicationId(foods),
		).map((food) => normalizeFoodForStorage(food)),
	});

	return result === "added" || result === "duplicate";
};

export const renameCloudIngredientListItem = async (
	key: IngredientListKey,
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

export const placeCloudIngredientListItem = async (
	key: IngredientListKey,
	food: FoodItem,
	allowMove = false,
	_context?: CloudDataContext,
): Promise<CloudListPlacementResult> => {
	const result = await placeFoodsThroughServer(key, {
		allowMove,
		food: normalizeFoodForStorage(food),
	});

	if (
		result === "added" ||
		result === "duplicate" ||
		result === "moved" ||
		result === "move-required:fridge" ||
		result === "move-required:shopping"
	) {
		return result;
	}

	return "error";
};

export const moveCloudIngredientListItems = async (
	sourceKey: IngredientListKey,
	targetKey: IngredientListKey,
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

export const removeCloudIngredientListItem = async (
	key: IngredientListKey,
	foodId: number,
) => {
	try {
		const path = `${getCloudListApiPath(key)}?foodId=${encodeURIComponent(foodId)}`;
		const response = await fetch(path, {
			method: "DELETE",
			headers: { accept: "application/json" },
		});
		if (!response.ok) return false;
		const payload = (await response.json()) as { removed?: unknown };
		return payload.removed === true;
	} catch {
		return false;
	}
};
