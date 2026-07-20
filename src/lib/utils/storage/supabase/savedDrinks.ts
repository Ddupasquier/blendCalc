import type { SavedDrink } from "$lib/utils/storage/client/savedDrinks";
import {
	CLOUD_CURSOR_PAGE_SIZE,
	type CloudDataContext,
	readAllCursorPages,
	resolveCloudClient,
	resolveCloudDataContext,
	toJson,
} from "./shared";

export type CloudSavedDrinkWriteResult = "saved" | "duplicate" | "error";

export const readCloudSavedDrinks = async (context?: CloudDataContext) => {
	const cloud = await resolveCloudDataContext(context);
	if (!cloud) return null;
	const { supabase, userId } = cloud;

	const rows = await readAllCursorPages(async (cursorId) => {
		let query = supabase
			.from("saved_drinks")
			.select("id, drink, created_at")
			.eq("user_id", userId)
			.order("id", { ascending: true })
			.limit(CLOUD_CURSOR_PAGE_SIZE);

		if (cursorId) query = query.gt("id", cursorId);
		return await query;
	});

	return rows
		.map((row) => ({
			...(row.drink as unknown as SavedDrink),
			id: row.id,
			createdAt:
				(row.drink as unknown as SavedDrink).createdAt ??
				new Date(row.created_at).getTime(),
		}))
		.sort((first, second) => second.createdAt - first.createdAt);
};

export const readCloudSavedDrinkById = async (
	drinkId: string,
	context?: CloudDataContext,
) => {
	const cloud = await resolveCloudDataContext(context);
	if (!cloud) return null;
	const { supabase, userId } = cloud;

	const { data, error } = await supabase
		.from("saved_drinks")
		.select("id, drink, created_at")
		.eq("user_id", userId)
		.eq("id", drinkId)
		.maybeSingle();
	if (error) throw error;
	if (!data) return null;

	return {
		...(data.drink as unknown as SavedDrink),
		id: data.id,
		createdAt:
			(data.drink as unknown as SavedDrink).createdAt ??
			new Date(data.created_at).getTime(),
	};
};

export const saveCloudSavedDrinkWithResult = async (
	drink: SavedDrink,
	context?: CloudDataContext,
): Promise<CloudSavedDrinkWriteResult> => {
	const supabase = resolveCloudClient(context);
	if (!supabase) return "error";

	const { data, error } = await supabase.rpc("save_saved_drink", {
		p_created_at: new Date(drink.createdAt).toISOString(),
		p_drink: toJson(drink),
		p_id: drink.id,
		p_name: drink.name,
	});

	if (error) return "error";
	if (data === "saved" || data === "duplicate") return data;
	return "error";
};

export const deleteCloudSavedDrink = async (
	drinkId: string,
	context?: CloudDataContext,
) => {
	const supabase = resolveCloudClient(context);
	if (!supabase) return false;

	const { data, error } = await supabase.rpc("delete_saved_drink", {
		p_id: drinkId,
	});

	return !error && data === true;
};
