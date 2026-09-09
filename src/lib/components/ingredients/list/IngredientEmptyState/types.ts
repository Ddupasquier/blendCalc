import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";

export type IngredientEmptyStateProps = {
	activeList: IngredientListKey;
	hasItems: boolean;
	scanning?: boolean;
	allowPlayfulMessages?: boolean;
	onScan: (event?: MouseEvent) => void;
};
