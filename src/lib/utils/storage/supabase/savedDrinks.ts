import { getSupabaseBrowserClient } from "$lib/supabase/client";
import type { SavedDrink } from "$lib/utils/storage/client/savedDrinks";
import {
	CLOUD_CURSOR_PAGE_SIZE,
	getCurrentUserId,
	readAllCursorPages,
	toJson,
} from "./shared";

export type CloudSavedDrinkWriteResult = "saved" | "duplicate" | "error";

export const readCloudSavedDrinks = async () => {
	const userId = await getCurrentUserId();
	if (!userId) return null;
	const supabase = getSupabaseBrowserClient();
	if (!supabase) return null;

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

export const saveCloudSavedDrinkWithResult = async (
	drink: SavedDrink,
): Promise<CloudSavedDrinkWriteResult> => {
	const userId = await getCurrentUserId();
	if (!userId) return "error";
	const supabase = getSupabaseBrowserClient();
	if (!supabase) return "error";

	const { error } = await supabase.from("saved_drinks").upsert({
		id: drink.id,
		user_id: userId,
		name: drink.name,
		drink: toJson(drink),
		created_at: new Date(drink.createdAt).toISOString(),
	});

	if (!error) return "saved";
	if (error.code === "23505") return "duplicate";
	return "error";
};

export const deleteCloudSavedDrink = async (drinkId: string) => {
	const userId = await getCurrentUserId();
	if (!userId) return false;
	const supabase = getSupabaseBrowserClient();
	if (!supabase) return false;

	const { error } = await supabase
		.from("saved_drinks")
		.delete()
		.eq("user_id", userId)
		.eq("id", drinkId);

	return !error;
};

export const reconcileCloudSavedDrinks = async (localDrinks: SavedDrink[]) => {
	const cloudDrinks = await readCloudSavedDrinks();
	if (!cloudDrinks) return localDrinks;
	return cloudDrinks;
};
