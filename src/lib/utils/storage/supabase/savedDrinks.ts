import { getSupabaseBrowserClient } from "$lib/supabase/client";
import type { SavedDrink } from "$lib/utils/storage/savedDrinks";
import { getCurrentUserId, toJson } from "./shared";

export type CloudSavedDrinkWriteResult = "saved" | "duplicate" | "error";

export const readCloudSavedDrinks = async () => {
	const userId = await getCurrentUserId();
	if (!userId) return null;
	const supabase = getSupabaseBrowserClient();
	if (!supabase) return null;

	const { data, error } = await supabase
		.from("saved_drinks")
		.select("id, drink, created_at")
		.eq("user_id", userId)
		.order("created_at", { ascending: false });

	if (error) return null;

	return data.map((row) => ({
		...(row.drink as unknown as SavedDrink),
		id: row.id,
		createdAt:
			(row.drink as unknown as SavedDrink).createdAt ??
			new Date(row.created_at).getTime(),
	}));
};

export const writeCloudSavedDrinks = async (drinks: SavedDrink[]) => {
	const userId = await getCurrentUserId();
	if (!userId) return false;
	const supabase = getSupabaseBrowserClient();
	if (!supabase) return false;

	if (drinks.length === 0) {
		const { error } = await supabase
			.from("saved_drinks")
			.delete()
			.eq("user_id", userId);
		return !error;
	}

	const { error: upsertError } = await supabase.from("saved_drinks").upsert(
		drinks.map((drink) => ({
			id: drink.id,
			user_id: userId,
			name: drink.name,
			drink: toJson(drink),
			created_at: new Date(drink.createdAt).toISOString(),
		})),
		{ onConflict: "id" },
	);
	if (upsertError) return false;

	const retainedIds = drinks.map((drink) => drink.id).join(",");
	const { error: deleteError } = await supabase
		.from("saved_drinks")
		.delete()
		.eq("user_id", userId)
		.not("id", "in", `(${retainedIds})`);

	return !deleteError;
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

export const saveCloudSavedDrink = async (drink: SavedDrink) => {
	return (await saveCloudSavedDrinkWithResult(drink)) === "saved";
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
