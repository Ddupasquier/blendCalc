import { LIST_PAGE_SIZES } from "../../../defaults/listDefaults";
import type { FdcFood } from "$lib/utils/food/types";

export const INGREDIENT_SEARCH_PAGE_SIZE = LIST_PAGE_SIZES.foodSearch;
export const INGREDIENT_SEARCH_MAX_PAGE_SIZE = 50;

export type IngredientSearchPageOptions = {
	offset?: number;
	limit?: number;
};

export type IngredientSearchPage = {
	foods: FdcFood[];
	hasMore: boolean;
	nextOffset: number | null;
	total: number;
};

export const paginateIngredientSearchResults = (
	foods: FdcFood[],
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
