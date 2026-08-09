import type { SavedRecipesPageInitialData } from "$lib/types/pageData/savedRecipesPageData";
import {
	readCloudSavedRecipes,
	type CloudDataContext,
} from "$lib/utils/storage/supabase";

export const loadSavedRecipesPageData = async (
	cloudDataContext: CloudDataContext,
): Promise<SavedRecipesPageInitialData> => {
	try {
		const savedRecipes = await readCloudSavedRecipes(cloudDataContext);
		if (!savedRecipes) {
			throw new Error("Authenticated saved recipes were unavailable.");
		}
		return { recipes: savedRecipes, loadError: "" };
	} catch (error) {
		console.error("[user-data] Saved recipe data could not load.", error);
		return {
			recipes: [],
			loadError: "Your saved recipes could not be loaded. Try again.",
		};
	}
};
