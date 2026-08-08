import type { FdcFood } from "$lib/utils/food/types";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";

export type ManualEntryCreateContext = {
	destination: IngredientListKey;
	addedToList: boolean;
	source: "manual-entry";
};

export type ManualEntryCreateHandler = (
	food: FdcFood,
	context: ManualEntryCreateContext,
) => void | Promise<void>;
