import type { NutritionPanelContentMode } from "$lib/components/ingredients/nutrition/types";
import type { FoodItem } from "$lib/utils/food/types";

export type ProductSafetyAlertsProps = {
	food: FoodItem;
	mode?: NutritionPanelContentMode;
};
