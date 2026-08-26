import type { NutritionPanelContentMode } from "$lib/components/ingredients/nutrition/types";
import type { FoodItem, FoodSafetyAlert } from "$lib/utils/food/types";

export type ProductSafetyAlertsProps = {
	food?: FoodItem;
	alerts?: FoodSafetyAlert[];
	mode?: NutritionPanelContentMode;
};
