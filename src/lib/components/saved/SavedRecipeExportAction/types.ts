import type { SavedRecipe } from "$lib/utils/storage/client/savedRecipes";
import type { RoundedActionButtonVariant } from "$lib/components/common/buttons/RoundedActionButton/types";

export type SavedRecipeExportActionProps = {
	recipe: SavedRecipe;
	compact?: boolean;
	fullWidth?: boolean;
	disabled?: boolean;
	variant?: RoundedActionButtonVariant;
};
