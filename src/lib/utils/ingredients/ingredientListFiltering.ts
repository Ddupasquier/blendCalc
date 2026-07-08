import type { FdcFood } from "$lib/utils/food/types";
import { getFoodSourceValue } from "$lib/utils/ingredients/ingredientSourceOptions";
import {
	filterItemsByQuery,
	sortFoodListItems,
	type FoodListSort,
} from "$lib/utils/list/listNavigation";
import {
	readSmoothieList,
	type SmoothieListKey,
} from "$lib/utils/storage/client/smoothieLists";

export type IngredientListFilterOptions = {
	query: string;
	sourceFilter: string;
	sort: FoodListSort;
};

export type IngredientListPage = {
	foods: FdcFood[];
	totalCount: number;
};

export const filterIngredientFoods = (
	foods: FdcFood[],
	options: IngredientListFilterOptions,
) => {
	const sourceFilteredFoods =
		options.sourceFilter === "all"
			? foods
			: foods.filter(
					(food) => getFoodSourceValue(food) === options.sourceFilter,
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

export const readLocalIngredientListPage = (
	key: SmoothieListKey,
	offset: number,
	limit: number,
	options: IngredientListFilterOptions,
): IngredientListPage => {
	const foods = filterIngredientFoods(readSmoothieList(key), options);
	return {
		foods: foods.slice(offset, offset + limit),
		totalCount: foods.length,
	};
};
