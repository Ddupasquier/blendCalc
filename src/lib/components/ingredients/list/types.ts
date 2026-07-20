import type { Snippet } from "svelte";
import type { FdcFood } from "$lib/utils/food/types";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";
import type { FoodPreferenceProfile } from "$lib/utils/profile/foodPreferenceProfile";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";

export type IngredientBulkActionsProps = {
	selectedCount: number;
	moveTargetLabel: string;
	moving?: boolean;
	onSelectAll: () => void;
	onClear: () => void;
	onMove: () => void;
};

export type IngredientBulkToggleProps = {
	checked?: boolean;
	label: string;
	onToggle: () => void;
};

export type IngredientEmptyStateProps = {
	activeList: SmoothieListKey;
	hasItems: boolean;
};

export type IngredientCardActionsProps = {
	description: string;
	removing?: boolean;
	removeArmed?: boolean;
	removeLabel?: string;
	removeMessageId?: string;
	onActions: () => void;
	onRemove: () => void;
};

export type SavedIngredientCardProps = {
	food: FdcFood;
	active?: boolean;
	checked?: boolean;
	moving?: boolean;
	removing?: boolean;
	moveDirection: "left" | "right";
	moveLabel: string;
	category: string;
	warning?: string | null;
	provenanceOptions?: readonly IngredientProvenanceOption[];
	onToggle: () => void;
	onPreview: () => void;
	onMove: () => void;
	onActions: () => void;
	onRemove: () => void;
};

export type SavedIngredientListProps = {
	activeList: SmoothieListKey;
	foods: FdcFood[];
	provenanceOptions?: readonly IngredientProvenanceOption[];
	activeRawCount?: number;
	listLoading?: boolean;
	loadingMoreList?: SmoothieListKey | null;
	canRevealMore?: boolean;
	selectedFoodId?: number | null;
	selectedIds?: number[];
	removingItem?: string | null;
	movingItem?: string | null;
	moving?: boolean;
	revealPaused?: boolean;
	preferenceProfile?: FoodPreferenceProfile | null;
	resetKey?: number;
	onSelectAll: () => void;
	onClearSelection: () => void;
	onMoveSelection: () => void;
	onMoveItem: (food: FdcFood) => void | Promise<void>;
	onToggle: (foodId: number) => void;
	onPreview: (food: FdcFood) => void;
	onActions: (food: FdcFood) => void;
	onRemove: (foodId: number) => void;
	onRevealMore: () => void | Promise<void>;
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
