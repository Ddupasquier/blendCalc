import type { FdcFood } from "$lib/utils/food/types";

export type SavedRecipeIngredientPillsProps = {
	foods: FdcFood[];
	visibleLimit?: number;
};
