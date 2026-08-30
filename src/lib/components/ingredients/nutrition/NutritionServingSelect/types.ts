import type { FoodItem } from "$lib/utils/food/types";
import type { NutritionViewingSelection } from "$lib/utils/food/nutrients/nutritionViewingAmount";

export type NutritionServingSelectProps = {
	food: FoodItem;
	selection: NutritionViewingSelection;
	onSelect: (selection: NutritionViewingSelection) => void;
};
