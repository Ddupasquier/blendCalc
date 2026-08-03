import type { NutritionPanelContentMode } from "$lib/components/ingredients/nutrition/types";
import type { FdcFood } from "$lib/utils/food/types";

export type NutritionPreferenceConflictProps = {
	food?: FdcFood;
	mode?: NutritionPanelContentMode;
};
