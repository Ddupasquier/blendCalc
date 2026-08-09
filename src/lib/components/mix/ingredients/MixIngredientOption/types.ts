import type { FoodItem } from "$lib/utils/food/types";

export type MixIngredientOptionProps = {
	food: FoodItem;
	selected: boolean;
	onSelect: () => void;
};
