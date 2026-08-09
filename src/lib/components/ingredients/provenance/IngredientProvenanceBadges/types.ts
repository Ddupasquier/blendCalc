import type { FoodItem } from "$lib/utils/food/types";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";

export type IngredientProvenanceBadgesProps = {
	food: FoodItem;
	provenanceOptions?: readonly IngredientProvenanceOption[];
	variant?: "saved-card" | "search-card" | "detail";
};
