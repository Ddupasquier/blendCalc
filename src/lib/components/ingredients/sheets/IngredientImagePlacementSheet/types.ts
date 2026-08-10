import type { ImagePlacementSaveHandler } from "$lib/components/ingredients/nutrition/types";
import type { FoodItem } from "$lib/utils/food/types";

export type IngredientImagePlacementSheetProps = {
	open: boolean;
	food: FoodItem | null;
	canAdjustImagePlacement: boolean;
	onClose: () => void;
	onImagePlacementSave: ImagePlacementSaveHandler;
};
