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

export const readCloudSmoothieList = async (key: SmoothieListKey) => {
	const userId = await getCurrentUserId();
	if (!userId) return null;
	const supabase = getSupabaseBrowserClient();
	if (!supabase) return null;

	const rows = await readAllCursorPages(async (cursorId) => {
		let query = supabase
			.from("user_food_list_items")
			.select("id, food")
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
		.map((row) =>
			hydrateFoodWithNormalizedNutrients(
				row.food as unknown as FdcFood,
				normalizedRows?.get(row.id),
			),
		)
		.sort((first, second) =>
			first.description.localeCompare(second.description),
		);
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
