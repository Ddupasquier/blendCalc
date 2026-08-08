import type { FoodItem } from "$lib/utils/food/types";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";

export type ManualEntryCreateContext = {
	destination: IngredientListKey;
	addedToList: boolean;
	source: "manual-entry";
};

export type ManualEntryCreateHandler = (
	food: FoodItem,
	context: ManualEntryCreateContext,
) => void | Promise<void>;
