import type { NutritionPanelContentMode } from "$lib/components/ingredients/nutrition/types";
import type { FoodItem } from "$lib/utils/food/types";

export type ProductCompatibilityPanelProps = {
	food: FoodItem;
	mode?: NutritionPanelContentMode;
};
