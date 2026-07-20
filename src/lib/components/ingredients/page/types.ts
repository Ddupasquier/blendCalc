import type { ManualEntryCreateContext } from "$lib/components/ingredients/manual-entry/types";
import type {
	IngredientFilterApplyPayload,
	IngredientSortOption,
} from "$lib/components/ingredients/sheets/types";
import type { FdcFood, FoodImageAsset } from "$lib/utils/food/types";
import type {
	IngredientActionItem,
	IngredientListMembership,
} from "$lib/utils/ingredients/ingredientListUi";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";
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
	listLoading: boolean;
	listMembership: IngredientListMembership;
	imagePlacementItem: IngredientActionItem | null;
	listQuery: string;
	listSort: FoodListSort;
	removingItem: string | null;
	renameBusy: boolean;
	renameError: string;
	renamingItem: IngredientRouteRenameItem;
	scanSignal: number;
	searchAddFoodId: number | null;
	savedFoodIdentityKeys: ReadonlySet<string>;
	searchViewOpen: boolean;
	provenanceOptions: readonly IngredientProvenanceOption[];
	selectedFood: FdcFood | null;
	selectedFoodShowListActions: boolean;
	sortOptions: readonly IngredientSortOption[];
	canAdjustImagePlacement: boolean;
	onAddSearchResult: (food: FdcFood) => void | Promise<void>;
	onApplyFilters: (filters: IngredientFilterApplyPayload) => void;
	onCloseActionSheet: () => void;
	onCloseImagePlacement: () => void;
	onCloseIngredientSheet: () => void;
	onCloseBarcodeScanner: () => void;
	onCloseNutrition: () => void;
	onCloseRename: () => void;
	onCloseSearch: () => void;
	onCreateManualIngredient: (
		food: FdcFood,
		context: ManualEntryCreateContext,
	) => void;
	onFilterFromSearch: () => void;
	onLookupStateChange: (busy: boolean) => void;
	onAdjustImagePlacementFromActionSheet: () => void;
	onRemoveFromActionSheet: () => void | Promise<void>;
	onRenameFromActionSheet: () => void;
	onRenameListItem: (name: string) => void | Promise<void>;
	onRenameValueChange: () => void;
	onScan: () => void;
	onSearchSelect: (food: FdcFood) => void;
	onImagePlacementSave: (image: FoodImageAsset) => void | Promise<void>;
};
