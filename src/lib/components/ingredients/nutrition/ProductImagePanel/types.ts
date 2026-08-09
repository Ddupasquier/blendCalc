import type {
	ImagePlacementSaveHandler,
	NutritionPanelContentMode,
} from "$lib/components/ingredients/nutrition/types";
import type { FoodItem } from "$lib/utils/food/types";

export type ProductImagePanelProps = {
	food?: FoodItem;
	mode?: NutritionPanelContentMode;
	placementPresentation?: "collapse" | "flat";
	canAdjustImagePlacement?: boolean;
	onImagePlacementSave?: ImagePlacementSaveHandler;
};
