import type { FdcFood, FoodServing } from "$lib/utils/food/types";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";

export type NutritionFactsLabelProps = {
	food?: FdcFood;
	viewingGrams: number;
	viewingServing?: FoodServing | null;
	provenanceOptions?: readonly IngredientProvenanceOption[];
};
