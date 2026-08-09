import type { Snippet } from "svelte";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";

export type SavedIngredientListLayoutProps = {
	activeList: IngredientListKey;
	fridgeCount: number;
	shoppingListCount: number;
	listLoading?: boolean;
	listActionError?: string;
	listLoadingError?: string;
	children: Snippet;
};
