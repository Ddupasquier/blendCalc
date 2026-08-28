import type { FoodListSort } from "$lib/utils/list/listNavigation";
import type { FoodSafetyFilter } from "$lib/utils/food/safety/foodSafetyFilters";

export type IngredientFilterOption = {
	value: string;
	label: string;
};

export type IngredientSortOption = {
	value: FoodListSort | string;
	label: string;
};

export type IngredientFilterApplyPayload = {
	query: string;
	sortValue: string;
	safetyFilter: FoodSafetyFilter;
};
