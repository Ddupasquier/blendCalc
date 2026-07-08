import type { ManualEntryCreateContext } from "$lib/components/ingredients/manual-entry/types";
import type {
	IngredientFilterApplyPayload,
	IngredientFilterOption,
	IngredientSortOption,
} from "$lib/components/ingredients/sheets/types";
import type { FdcFood } from "$lib/utils/food/types";
import type {
	IngredientActionItem,
	IngredientListMembership,
} from "$lib/utils/ingredients/ingredientListUi";
import type { IngredientSourceOption } from "$lib/utils/ingredients/ingredientSourceOptions";
import type { FoodListSort } from "$lib/utils/list/listNavigation";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";

export type IngredientRouteActiveSheet = "manual-entry" | "filters" | null;

export type IngredientRouteNavigationOptions = {
	replaceState?: boolean;
};

export type IngredientRouteRenameItem = {
	key: SmoothieListKey;
	food: FdcFood;
} | null;

export type IngredientsSearchPanelProps = {
	barcodeLookupBusy?: boolean;
	filtersActive?: boolean;
	onOpenSearch: () => void;
	onScan: () => void;
	onToggleFilters: () => void;
	onOpenManualEntry: () => void;
};

export type IngredientsFloatingAddButtonProps = {
	onClick: () => void;
};

export type IngredientRoutePopinsProps = {
	activeSheet: IngredientRouteActiveSheet;
	actionSheetItem: IngredientActionItem | null;
	barcodeLookupBusy: boolean;
	filterOptions: readonly IngredientFilterOption[];
	filterValue: string;
	listLoading: boolean;
	listMembership: IngredientListMembership;
	listQuery: string;
	listSort: FoodListSort;
	removingItem: string | null;
	renameBusy: boolean;
	renameError: string;
	renamingItem: IngredientRouteRenameItem;
	scanSignal: number;
	searchAddFoodId: number | null;
	searchViewOpen: boolean;
	sourceOptions: readonly IngredientSourceOption[];
	selectedFood: FdcFood | null;
	selectedFoodShowListActions: boolean;
	sortOptions: readonly IngredientSortOption[];
	onAddSearchResult: (food: FdcFood) => void | Promise<void>;
	onApplyFilters: (filters: IngredientFilterApplyPayload) => void;
	onCloseActionSheet: () => void;
	onCloseIngredientSheet: () => void;
	onCloseNutrition: () => void;
	onCloseRename: () => void;
	onCloseSearch: () => void;
	onCreateManualIngredient: (
		food: FdcFood,
		context: ManualEntryCreateContext,
	) => void;
	onFilterFromSearch: () => void;
	onLookupStateChange: (busy: boolean) => void;
	onRemoveFromActionSheet: () => void | Promise<void>;
	onRenameFromActionSheet: () => void;
	onRenameListItem: (name: string) => void | Promise<void>;
	onRenameValueChange: () => void;
	onScan: () => void;
	onSearchSelect: (food: FdcFood) => void;
};
