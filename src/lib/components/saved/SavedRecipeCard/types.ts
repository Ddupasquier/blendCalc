import type { SavedRecipe } from "$lib/utils/storage/client/savedRecipes";

export type SavedRecipeCardProps = {
	recipe: SavedRecipe;
	loading?: boolean;
	deleting?: boolean;
	disabled?: boolean;
	tutorialTarget?: string;
	onLoad: (recipe: SavedRecipe) => void;
	onDelete: (recipe: SavedRecipe) => void;
};
