import type { FdcFood } from "$lib/utils/food/types";
import type { IngredientListMembership } from "$lib/utils/ingredients/ingredientListUi";

export type NutritionListActionsProps = {
	food?: FdcFood;
	showListActions?: boolean;
	listMembership?: IngredientListMembership;
};
