import type { FoodItem } from "$lib/utils/food/types";

export type SavedRecipeIngredientPillsProps = {
	foods: FoodItem[];
	visibleLimit?: number;
};
