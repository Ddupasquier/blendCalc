import type { FoodItem, FoodServing } from "$lib/utils/food/types";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";

export type NutritionFactsLabelProps = {
	food?: FoodItem;
	viewingGrams: number;
	viewingServing?: FoodServing | null;
	provenanceOptions?: readonly IngredientProvenanceOption[];
};
