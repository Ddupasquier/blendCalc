import type { FdcFood } from "$lib/utils/food/types";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";

export type IngredientProvenanceBadgesProps = {
	food: FdcFood;
	provenanceOptions?: readonly IngredientProvenanceOption[];
};
