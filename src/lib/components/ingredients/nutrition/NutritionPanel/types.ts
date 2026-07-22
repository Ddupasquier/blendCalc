import type { ImagePlacementSaveHandler } from "$lib/components/ingredients/nutrition/types";
import type { FdcFood, FoodServing } from "$lib/utils/food/types";
import type { IngredientListMembership } from "$lib/utils/ingredients/ingredientListUi";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";

export type NutritionPanelProps = {
	food?: FdcFood;
	showListActions?: boolean;
	viewingGrams?: number;
	viewingServing?: FoodServing | null;
	listMembership?: IngredientListMembership;
	canAdjustImagePlacement?: boolean;
	onImagePlacementSave?: ImagePlacementSaveHandler;
	provenanceOptions?: readonly IngredientProvenanceOption[];
};
