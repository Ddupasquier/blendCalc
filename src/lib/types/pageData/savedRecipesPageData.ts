import type { SavedRecipe } from "$lib/utils/storage/client/savedRecipes";

export type SavedRecipesPageInitialData = {
	recipes: SavedRecipe[];
	loadError: string;
};
