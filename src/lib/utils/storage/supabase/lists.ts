import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import { compactFood, uniqueFoodsById } from "$lib/utils/food/records/foodRecords";
import { uniqueFoodsByIdentity } from "$lib/utils/food/records/foodIdentity";
import type { FdcFood } from "$lib/utils/food/types";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
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

const getCloudListApiPath = (key: SmoothieListKey) =>
	key === MIX_STORAGE_KEYS.fridge
		? "/api/user-food-lists/fridge"
		: "/api/user-food-lists/shopping-list";

const placeFoodsThroughServer = async (
	key: SmoothieListKey,
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
		const payload = await response.json() as { result?: unknown };
		return payload.result;
	} catch {
		return null;
	}
};

export type CloudListSort = "recent" | "oldest" | "name-asc" | "name-desc";

export type CloudSmoothieListPageOptions = {
	limit: number;
	offset?: number;
	query?: string;
	sort?: CloudListSort;
	sourceFilter?: string;
	trustFilter?: string;
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
	if (foods.length === 0) return true;

	const result = await placeFoodsThroughServer(key, {
		foods: uniqueFoodsByIdentity(uniqueFoodsById(foods)).map((food) =>
			compactFood(food),
		),
	});

	return result === "added" || result === "duplicate";
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
	const result = await placeFoodsThroughServer(key, {
		allowMove,
		food: compactFood(food),
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
) => {
	try {
		const path = `${getCloudListApiPath(key)}?foodId=${encodeURIComponent(foodId)}`;
		const response = await fetch(path, {
			method: "DELETE",
			headers: { accept: "application/json" },
		});
		if (!response.ok) return false;
		const payload = await response.json() as { removed?: unknown };
		return payload.removed === true;
	} catch {
		return false;
	}
};
