import type { FoodItem } from "$lib/utils/food/types";
import type { IngredientListMembership } from "$lib/utils/ingredients/ingredientListUi";

export type NutritionListActionsProps = {
	food?: FoodItem;
	showListActions?: boolean;
	listMembership?: IngredientListMembership;
};
