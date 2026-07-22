import type { ImagePlacementSaveHandler } from "$lib/components/ingredients/nutrition/types";
import type { FdcFood } from "$lib/utils/food/types";

export type IngredientImagePlacementSheetProps = {
	open: boolean;
	food: FdcFood | null;
	canAdjustImagePlacement: boolean;
	onClose: () => void;
	onImagePlacementSave: ImagePlacementSaveHandler;
};
