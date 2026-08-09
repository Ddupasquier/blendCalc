import type { ImagePlacementSaveHandler } from "$lib/components/ingredients/nutrition/types";
import type { FoodItem } from "$lib/utils/food/types";
import type { IngredientListMembership } from "$lib/utils/ingredients/ingredientListUi";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";

export type NutritionDetailViewProps = {
	food: FoodItem;
	onClose: () => void;
	showListActions?: boolean;
	listMembership?: IngredientListMembership;
	canAdjustImagePlacement?: boolean;
	onImagePlacementSave?: ImagePlacementSaveHandler;
	provenanceOptions?: readonly IngredientProvenanceOption[];
	onReportIncorrectInformation?: () => void;
};
