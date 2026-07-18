import type { FoodImageAsset, FdcFood, FoodServing } from "$lib/utils/food/types";
import type { IngredientListMembership } from "$lib/utils/ingredients/ingredientListUi";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";

export type ImagePlacementSaveHandler = (
	image: FoodImageAsset,
	foodId?: number,
) => void | Promise<void>;

export type ProductImagePanelProps = {
	food?: FdcFood;
	canAdjustImagePlacement?: boolean;
	onImagePlacementSave?: ImagePlacementSaveHandler;
};

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

export type NutritionFactsLabelProps = {
	food?: FdcFood;
	viewingGrams: number;
	viewingServing?: FoodServing | null;
	provenanceOptions?: readonly IngredientProvenanceOption[];
};

export type NutritionServingStatementProps = {
	serving?: FoodServing | null;
};

export type NutritionPreferenceConflictProps = {
	food?: FdcFood;
};

export type NutritionDetailViewProps = {
	food: FdcFood;
	onClose: () => void;
	showListActions?: boolean;
	listMembership?: IngredientListMembership;
	canAdjustImagePlacement?: boolean;
	onImagePlacementSave?: ImagePlacementSaveHandler;
	provenanceOptions?: readonly IngredientProvenanceOption[];
};

export type NutritionServingSelectProps = {
	food: FdcFood;
	viewingGrams: number;
	onSelect: (gramWeight: number) => void;
};
