import type { ImagePlacementSaveHandler } from "$lib/components/ingredients/nutrition/types";
import type { FdcFood } from "$lib/utils/food/types";

export type ProductImagePanelProps = {
	food?: FdcFood;
	canAdjustImagePlacement?: boolean;
	onImagePlacementSave?: ImagePlacementSaveHandler;
};
