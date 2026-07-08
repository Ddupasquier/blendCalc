<script lang="ts">
	import RightSheet from "$lib/components/common/sheets/RightSheet.svelte";
	import TextInputDialog from "$lib/components/common/dialogs/TextInputDialog.svelte";
	import IngredientActionSheet from "$lib/components/ingredients/sheets/IngredientActionSheet.svelte";
	import IngredientFilterSheet from "$lib/components/ingredients/sheets/IngredientFilterSheet.svelte";
	import ManualEntrySheet from "$lib/components/ingredients/sheets/ManualEntrySheet.svelte";
	import IngredientSearchView from "$lib/components/ingredients/search/IngredientSearchView.svelte";
	import NutritionDetailView from "$lib/components/ingredients/nutrition/NutritionDetailView.svelte";
	import { getIngredientListLabel } from "$lib/utils/ingredients/ingredientListUi";
	import type { IngredientRoutePopinsProps } from "$lib/components/ingredients/page/types";

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
		sourceOptions,
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
	}: IngredientRoutePopinsProps = $props();
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
		{sourceOptions}
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
