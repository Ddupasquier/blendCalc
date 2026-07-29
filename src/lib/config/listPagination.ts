export const LIST_PAGE_SIZES = {
	foodSearch: 15,
	ingredientPills: 12,
	ingredientLoadMore: 15,
	mixChooser: 10,
	selectedIngredients: 6,
	savedDrinks: 6,
} as const;

export const LIST_PAGE_LIMITS = {
	userFoodListRequest: 100,
} as const;

export const LIST_SEARCH_THRESHOLDS = {
	selectedIngredients: 7,
} as const;
