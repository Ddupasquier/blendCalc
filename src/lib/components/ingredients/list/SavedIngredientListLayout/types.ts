import type { Snippet } from "svelte";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";

export type SavedIngredientListLayoutProps = {
	activeList: SmoothieListKey;
	fridgeCount: number;
	shoppingListCount: number;
	listLoading?: boolean;
	listActionError?: string;
	listLoadingError?: string;
	onSelectList: (key: SmoothieListKey) => void;
	children: Snippet;
};
