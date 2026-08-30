import type { FoodItem, FoodServing } from "$lib/utils/food/types";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";
import type { ServingConversion } from "$lib/utils/serving/servingAmount";

export type NutritionFactsLabelProps = {
	food?: FoodItem;
	viewingConversion: ServingConversion;
	viewingLabel: string;
	viewingServing?: FoodServing | null;
	provenanceOptions?: readonly IngredientProvenanceOption[];
};
