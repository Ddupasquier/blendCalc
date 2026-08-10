import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";

export type IngredientEmptyStateProps = {
	activeList: IngredientListKey;
	hasItems: boolean;
};
