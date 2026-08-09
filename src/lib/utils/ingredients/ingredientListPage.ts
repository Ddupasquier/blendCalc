import type { FoodItem } from "$lib/utils/food/types";

export type IngredientListPage = {
	foods: FoodItem[];
	totalCount: number;
};
