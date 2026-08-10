import type { ImagePlacementSaveHandler } from "$lib/components/ingredients/nutrition/types";
import type { FoodItem, FoodServing } from "$lib/utils/food/types";
import type { IngredientListMembership } from "$lib/utils/ingredients/ingredientListUi";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";

export type NutritionPanelProps = {
	food?: FoodItem;
	showListActions?: boolean;
	viewingGrams?: number;
	viewingServing?: FoodServing | null;
	listMembership?: IngredientListMembership;
	canAdjustImagePlacement?: boolean;
	onImagePlacementSave?: ImagePlacementSaveHandler;
	provenanceOptions?: readonly IngredientProvenanceOption[];
	onReportIncorrectInformation?: () => void;
};
