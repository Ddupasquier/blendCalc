import type { FoodImageAsset } from "$lib/utils/food/types";

export type NutritionPanelContentMode = "all" | "summary" | "details";

export type ImagePlacementSaveHandler = (
	image: FoodImageAsset,
	foodId?: number,
) => void | Promise<void>;
