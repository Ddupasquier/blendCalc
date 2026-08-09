import { LIST_PAGE_SIZES } from "$lib/config/listPagination";
import type { FoodItem } from "$lib/utils/food/types";

export const INGREDIENT_SEARCH_PAGE_SIZE = LIST_PAGE_SIZES.foodSearch;
export const INGREDIENT_SEARCH_LOAD_MORE_PAGE_SIZE =
	LIST_PAGE_SIZES.ingredientLoadMore;
export const INGREDIENT_SEARCH_MAX_PAGE_SIZE = 50;

export type IngredientSearchPageOptions = {
	offset?: number;
	limit?: number;
	sourceFilter?: string;
	trustFilter?: string;
};

export type IngredientSearchPage = {
	foods: FoodItem[];
	hasMore: boolean;
	nextOffset: number | null;
	total: number;
};

export const paginateIngredientSearchResults = (
	foods: FoodItem[],
	offset: number,
	limit: number,
): IngredientSearchPage => {
	const pageFoods = foods.slice(offset, offset + limit);
	const loadedThrough = offset + pageFoods.length;
	const hasMore = loadedThrough < foods.length;

	return {
		foods: pageFoods,
		hasMore,
		nextOffset: hasMore ? loadedThrough : null,
		total: foods.length,
	};
};
