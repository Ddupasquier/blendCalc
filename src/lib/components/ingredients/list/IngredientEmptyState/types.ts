import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";

export type IngredientEmptyStateProps = {
	activeList: SmoothieListKey;
	hasItems: boolean;
};
