import type {
	ImagePlacementSaveHandler,
	NutritionPanelContentMode,
} from "$lib/components/ingredients/nutrition/types";
import type { FdcFood } from "$lib/utils/food/types";

export type ProductImagePanelProps = {
	food?: FdcFood;
	mode?: NutritionPanelContentMode;
	canAdjustImagePlacement?: boolean;
	onImagePlacementSave?: ImagePlacementSaveHandler;
};
