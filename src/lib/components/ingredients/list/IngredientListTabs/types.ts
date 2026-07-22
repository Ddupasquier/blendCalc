import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";

export type IngredientListTabsProps = {
	activeList: SmoothieListKey;
	fridgeCount: number;
	shoppingListCount: number;
	onSelect: (key: SmoothieListKey) => void;
};
