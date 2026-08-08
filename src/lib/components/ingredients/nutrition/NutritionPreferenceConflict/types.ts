import type { NutritionPanelContentMode } from "$lib/components/ingredients/nutrition/types";
import type { FoodItem } from "$lib/utils/food/types";

export type NutritionPreferenceConflictProps = {
	food?: FoodItem;
	mode?: NutritionPanelContentMode;
};
