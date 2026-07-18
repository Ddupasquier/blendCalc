import type { ManualEntryCreateHandler } from "$lib/components/ingredients/manual-entry/types";
import type { ImagePlacementSaveHandler } from "$lib/components/ingredients/nutrition/types";
import type { FdcFood } from "$lib/utils/food/types";
import type { FoodListSort } from "$lib/utils/list/listNavigation";

export type IngredientFilterOption = {
	value: string;
	label: string;
};

export type IngredientSortOption = {
	value: FoodListSort | string;
	label: string;
};

export type IngredientFilterApplyPayload = {
	query: string;
	filterValue: string;
	trustValue: string;
	sortValue: string;
};

export type IngredientFilterSheetProps = {
	open: boolean;
	query: string;
	filterValue: string;
	filterOptions: readonly IngredientFilterOption[];
	trustValue: string;
	trustOptions: readonly IngredientFilterOption[];
	sortValue: FoodListSort | string;
	sortOptions: readonly IngredientSortOption[];
	loading?: boolean;
	onApply: (filters: IngredientFilterApplyPayload) => void;
	onClose: () => void;
};

export type ManualEntrySheetProps = {
	open: boolean;
	scanSignal?: number;
	onClose: () => void;
	onScannerClose?: () => void;
	onCreate: ManualEntryCreateHandler;
	onLookupStateChange?: (lookingUp: boolean) => void;
};

export type IngredientActionSheetProps = {
	open: boolean;
	title: string;
	removeLabel: string;
	removing?: boolean;
	canAdjustImagePlacement?: boolean;
	onClose: () => void;
	onAdjustImagePlacement?: () => void;
	onRename: () => void;
	onRemove: () => void;
};

export type IngredientImagePlacementSheetProps = {
	open: boolean;
	food: FdcFood | null;
	canAdjustImagePlacement: boolean;
	onClose: () => void;
	onImagePlacementSave: ImagePlacementSaveHandler;
};
