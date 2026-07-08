<script lang="ts">
	import RightSheet from "$lib/components/common/sheets/RightSheet.svelte";
	import TextInputDialog from "$lib/components/common/dialogs/TextInputDialog.svelte";
	import IngredientActionSheet from "$lib/components/ingredients/sheets/IngredientActionSheet.svelte";
	import IngredientFilterSheet from "$lib/components/ingredients/sheets/IngredientFilterSheet.svelte";
	import ManualEntrySheet from "$lib/components/ingredients/sheets/ManualEntrySheet.svelte";
	import IngredientSearchView from "$lib/components/ingredients/search/IngredientSearchView.svelte";
	import NutritionDetailView from "$lib/components/ingredients/nutrition/NutritionDetailView.svelte";
	import type { ManualEntryCreateContext } from "$lib/components/ingredients/manual-entry/types";
	import type { FdcFood } from "$lib/utils/food/types";
	import {
		getIngredientListLabel,
		type IngredientActionItem,
		type IngredientListMembership,
	} from "$lib/utils/ingredients/ingredientListUi";
	import type { FoodListSort } from "$lib/utils/list/listNavigation";
	import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";

	type ActiveSheet = "manual-entry" | "filters" | null;
	type RenameItem = { key: SmoothieListKey; food: FdcFood } | null;
	type FilterOption = { label: string; value: string };
	type SortOption = { label: string; value: FoodListSort | string };

	let {
		activeSheet,
		actionSheetItem,
		barcodeLookupBusy,
		filterOptions,
		filterValue,
		listLoading,
		listMembership,
		listQuery,
		listSort,
		removingItem,
		renameBusy,
		renameError,
		renamingItem,
		scanSignal,
		searchAddFoodId,
		searchViewOpen,
		selectedFood,
		selectedFoodShowListActions,
		sortOptions,
		onAddSearchResult,
		onApplyFilters,
		onCloseActionSheet,
		onCloseIngredientSheet,
		onCloseNutrition,
		onCloseRename,
		onCloseSearch,
		onCreateManualIngredient,
		onFilterFromSearch,
		onLookupStateChange,
		onRemoveFromActionSheet,
		onRenameFromActionSheet,
		onRenameListItem,
		onRenameValueChange,
		onScan,
		onSearchSelect,
	}: {
		activeSheet: ActiveSheet;
		actionSheetItem: IngredientActionItem | null;
		barcodeLookupBusy: boolean;
		filterOptions: readonly FilterOption[];
		filterValue: string;
		listLoading: boolean;
		listMembership: IngredientListMembership;
		listQuery: string;
		listSort: FoodListSort;
		removingItem: string | null;
		renameBusy: boolean;
		renameError: string;
		renamingItem: RenameItem;
		scanSignal: number;
		searchAddFoodId: number | null;
		searchViewOpen: boolean;
		selectedFood: FdcFood | null;
		selectedFoodShowListActions: boolean;
		sortOptions: readonly SortOption[];
		onAddSearchResult: (food: FdcFood) => void | Promise<void>;
		onApplyFilters: (filters: {
			query: string;
			filterValue: string;
			sortValue: string;
		}) => void;
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
	} = $props();
</script>

<IngredientActionSheet
	open={actionSheetItem !== null}
	title={actionSheetItem?.food.description ?? ""}
	removeLabel={actionSheetItem
		? `Remove from ${getIngredientListLabel(actionSheetItem.key)}`
		: ""}
	removing={removingItem !== null}
	onClose={onCloseActionSheet}
	onRename={onRenameFromActionSheet}
	onRemove={onRemoveFromActionSheet}
/>

<ManualEntrySheet
	open={activeSheet === "manual-entry"}
	{scanSignal}
	onClose={onCloseIngredientSheet}
	onCreate={onCreateManualIngredient}
	onLookupStateChange={onLookupStateChange}
/>

<IngredientFilterSheet
	open={activeSheet === "filters"}
	query={listQuery}
	{filterValue}
	filterOptions={[...filterOptions]}
	sortValue={listSort}
	sortOptions={[...sortOptions]}
	loading={listLoading}
	onApply={onApplyFilters}
	onClose={onCloseIngredientSheet}
/>

<TextInputDialog
	open={renamingItem !== null}
	title="Rename ingredient"
	description="This only changes the display label in your lists. Original data is preserved."
	label="Ingredient name"
	initialValue={renamingItem?.food.description ?? ""}
	error={renameError}
	busy={renameBusy}
	confirmLabel={renameBusy ? "Saving…" : "Save name"}
	onConfirm={onRenameListItem}
	onValueChange={onRenameValueChange}
	onCancel={onCloseRename}
/>

<RightSheet
	open={searchViewOpen}
	labelledby="ingredient-search-view-title"
	onClose={onCloseSearch}
>
	<IngredientSearchView
		scanning={barcodeLookupBusy}
		filtersActive={activeSheet === "filters"}
		onSelect={onSearchSelect}
		onAdd={onAddSearchResult}
		addingFoodId={searchAddFoodId}
		onScan={onScan}
		onFilter={onFilterFromSearch}
		onClose={onCloseSearch}
	/>
</RightSheet>

<RightSheet
	open={selectedFood !== null}
	labelledby="nutrition-detail-view-title"
	onClose={onCloseNutrition}
>
	{#if selectedFood}
		<NutritionDetailView
			food={selectedFood}
			showListActions={selectedFoodShowListActions}
			listMembership={listMembership}
			onClose={onCloseNutrition}
		/>
	{/if}
</RightSheet>
