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

const hasFavoriteRecipeTarget = (relationship: unknown, recipeId: string) => {
	const rows = Array.isArray(relationship) ? relationship : [relationship];
	return rows.some(
		(row) =>
			row !== null &&
			typeof row === "object" &&
			(row as { recipe_id?: unknown }).recipe_id === recipeId,
	);
};

export const readCloudSavedRecipes = async (context?: CloudDataContext) => {
	const cloud = await resolveCloudDataContext(context);
	if (!cloud) return null;
	const { supabase, userId } = cloud;

	const rows = await readAllCursorPages(async (cursorId) => {
		let query = supabase
			.from("saved_drinks")
			.select("id, drink, created_at, user_saved_recipe_favorites(recipe_id)")
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
			isFavorite: hasFavoriteRecipeTarget(
				row.user_saved_recipe_favorites,
				row.id,
			),
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
		.select("id, drink, created_at, user_saved_recipe_favorites(recipe_id)")
		.eq("user_id", userId)
		.eq("id", recipeId)
		.maybeSingle();
	if (error) throw error;
	if (!data) return null;

	return {
		...(data.drink as unknown as SavedRecipe),
		id: data.id,
		isFavorite: hasFavoriteRecipeTarget(
			data.user_saved_recipe_favorites,
			data.id,
		),
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
		p_drink: toJson(
			Object.fromEntries(
				Object.entries(recipe).filter(([key]) => key !== "isFavorite"),
			),
		),
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
