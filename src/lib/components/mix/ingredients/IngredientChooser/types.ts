import type { FdcFood } from "$lib/utils/food/types";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";

export type IngredientChooserProps = {
	fridgeItems: FdcFood[];
	shoppingItems: FdcFood[];
	selectedFoodIds: number[];
	renameRoute?: {
		listKey: SmoothieListKey;
		foodId: number;
	} | null;
	onOpenRename: (listKey: SmoothieListKey, foodId: number) => void;
	onCloseRename: () => void;
	onToggleFood: (foodId: number) => void;
};
