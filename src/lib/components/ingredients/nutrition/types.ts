import type { FoodImageAsset, FdcFood } from "$lib/utils/food/types";
import type { IngredientListMembership } from "$lib/utils/ingredients/ingredientListUi";

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
	listMembership?: IngredientListMembership;
	canAdjustImagePlacement?: boolean;
	onImagePlacementSave?: ImagePlacementSaveHandler;
};

export type NutritionDetailViewProps = {
	food: FdcFood;
	onClose: () => void;
	showListActions?: boolean;
	listMembership?: IngredientListMembership;
	canAdjustImagePlacement?: boolean;
	onImagePlacementSave?: ImagePlacementSaveHandler;
};
