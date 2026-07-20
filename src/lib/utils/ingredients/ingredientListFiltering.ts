import type { FdcFood } from "$lib/utils/food/types";
import { matchesIngredientProvenance } from "$lib/utils/ingredients/ingredientProvenance";
import {
	filterItemsByQuery,
	sortFoodListItems,
	type FoodListSort,
} from "$lib/utils/list/listNavigation";

export type IngredientListFilterOptions = {
	query: string;
	sourceFilter: string;
	trustFilter?: string;
	sort: FoodListSort;
};

export const filterIngredientFoods = (
	foods: FdcFood[],
	options: IngredientListFilterOptions,
) => {
	const sourceFilteredFoods = foods.filter((food) =>
		matchesIngredientProvenance(
			food,
			options.sourceFilter,
			options.trustFilter ?? "any",
		)
	);

	const queryFilteredFoods = filterItemsByQuery(
		sourceFilteredFoods,
		options.query,
		(food) =>
			[food.description, food.brandOwner, food.foodCategory]
				.filter(Boolean)
				.join(" "),
	);

	return sortFoodListItems(
		queryFilteredFoods,
		options.sort,
		(food) => food.description,
		(food) => food.listAddedAt,
	);
};
