import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";

export type IngredientListTabsProps = {
	activeList: IngredientListKey;
	fridgeCount: number;
	shoppingListCount: number;
};
