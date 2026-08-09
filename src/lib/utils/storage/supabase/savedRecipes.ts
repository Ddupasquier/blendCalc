import type { SavedRecipe } from "$lib/utils/storage/client/savedRecipes";
import {
	CLOUD_CURSOR_PAGE_SIZE,
	type CloudDataContext,
	readAllCursorPages,
	resolveCloudClient,
	resolveCloudDataContext,
	toJson,
} from "./shared";

export type CloudSavedRecipeWriteResult = "saved" | "duplicate" | "error";

export const readCloudSavedRecipes = async (context?: CloudDataContext) => {
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
			...(row.drink as unknown as SavedRecipe),
			id: row.id,
			createdAt:
				(row.drink as unknown as SavedRecipe).createdAt ??
				new Date(row.created_at).getTime(),
		}))
		.sort((first, second) => second.createdAt - first.createdAt);
};

export const readCloudSavedRecipeById = async (
	recipeId: string,
	context?: CloudDataContext,
) => {
	const cloud = await resolveCloudDataContext(context);
	if (!cloud) return null;
	const { supabase, userId } = cloud;

	const { data, error } = await supabase
		.from("saved_drinks")
		.select("id, drink, created_at")
		.eq("user_id", userId)
		.eq("id", recipeId)
		.maybeSingle();
	if (error) throw error;
	if (!data) return null;

	return {
		...(data.drink as unknown as SavedRecipe),
		id: data.id,
		createdAt:
			(data.drink as unknown as SavedRecipe).createdAt ??
			new Date(data.created_at).getTime(),
	};
};

export const saveCloudSavedRecipeWithResult = async (
	recipe: SavedRecipe,
	context?: CloudDataContext,
): Promise<CloudSavedRecipeWriteResult> => {
	const supabase = resolveCloudClient(context);
	if (!supabase) return "error";

	const { data, error } = await supabase.rpc("save_saved_drink", {
		p_created_at: new Date(recipe.createdAt).toISOString(),
		p_drink: toJson(recipe),
		p_id: recipe.id,
		p_name: recipe.name,
	});

	if (error) return "error";
	if (data === "saved" || data === "duplicate") return data;
	return "error";
};

export const deleteCloudSavedRecipe = async (
	recipeId: string,
	context?: CloudDataContext,
) => {
	const supabase = resolveCloudClient(context);
	if (!supabase) return false;

	const { data, error } = await supabase.rpc("delete_saved_drink", {
		p_id: recipeId,
	});

	return !error && data === true;
};
