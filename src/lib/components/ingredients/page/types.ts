import type { FoodItem } from "$lib/utils/food/types";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";

export type IngredientRouteActiveSheet = "manual-entry" | "filters" | null;

export type IngredientRouteNavigationOptions = {
	replaceState?: boolean;
};

export type IngredientRouteRenameItem = {
	key: IngredientListKey;
	food: FoodItem;
} | null;
