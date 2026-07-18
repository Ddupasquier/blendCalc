import type { Snippet } from "svelte";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";

export type IngredientCardActionsProps = {
	description: string;
	removing?: boolean;
	removeArmed?: boolean;
	removeLabel?: string;
	removeMessageId?: string;
	onActions: () => void;
	onRemove: () => void;
};

export type IngredientListTabsProps = {
	activeList: SmoothieListKey;
	fridgeCount: number;
	shoppingListCount: number;
	onSelect: (key: SmoothieListKey) => void;
};

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
