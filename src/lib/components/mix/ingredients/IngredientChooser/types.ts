import type { FdcFood } from "$lib/utils/food/types";

export type IngredientChooserProps = {
	fridgeItems: FdcFood[];
	shoppingItems: FdcFood[];
	selectedFoodIds: number[];
	onToggleFood: (foodId: number) => void;
};
