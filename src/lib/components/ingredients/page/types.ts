import type { FdcFood } from "$lib/utils/food/types";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";

export type IngredientRouteActiveSheet = "manual-entry" | "filters" | null;

export type IngredientRouteNavigationOptions = {
	replaceState?: boolean;
};

export type IngredientRouteRenameItem = {
	key: SmoothieListKey;
	food: FdcFood;
} | null;
