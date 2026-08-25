<script lang="ts">
	import RightSheet from "$lib/components/common/sheets/RightSheet/RightSheet.svelte";
	import TextInputDialog from "$lib/components/common/dialogs/TextInputDialog/TextInputDialog.svelte";
	import IngredientActionSheet from "$lib/components/ingredients/sheets/IngredientActionSheet/IngredientActionSheet.svelte";
	import IngredientFilterSheet from "$lib/components/ingredients/sheets/IngredientFilterSheet/IngredientFilterSheet.svelte";
	import IngredientImagePlacementSheet from "$lib/components/ingredients/sheets/IngredientImagePlacementSheet/IngredientImagePlacementSheet.svelte";
	import ManualEntrySheet from "$lib/components/ingredients/sheets/ManualEntrySheet/ManualEntrySheet.svelte";
	import IngredientSearchView from "$lib/components/ingredients/search/IngredientSearchView/IngredientSearchView.svelte";
	import NutritionDetailView from "$lib/components/ingredients/nutrition/NutritionDetailView/NutritionDetailView.svelte";
	import { getIngredientListLabel } from "$lib/utils/ingredients/ingredientListUi";
	import type { IngredientRoutePopinsProps } from "./types";

	let {
		activeSheet,
		actionSheetItem,
		barcodeLookupBusy,
		listLoading,
		listMembership,
		imagePlacementItem,
		listQuery,
		listSort,
		removingItem,
		renameBusy,
		renameError,
		renamingItem,
		scanSignal,
		searchAddFoodId,
		destinationListKey,
		destinationListFoodIdentityKeys,
		otherListFoodIdentityKeys,
		searchViewOpen,
		provenanceOptions,
		selectedFood,
		selectedFoodShowListActions,
		correctionFood,
		sortOptions,
		canAdjustImagePlacement,
		onAddSearchResult,
		onApplyFilters,
		onCloseActionSheet,
		onCloseImagePlacement,
		onCloseIngredientSheet,
		onCloseBarcodeScanner,
		moveConfirmationRouteOpen,
		onOpenMoveConfirmation,
		onCloseMoveConfirmation,
		onCloseNutrition,
		onCloseCorrection,
		onOpenCorrection,
		onCloseRename,
		onCloseSearch,
		onCreateManualIngredient,
		onFilterFromSearch,
		onLookupStateChange,
		onAdjustImagePlacementFromActionSheet,
		onRemoveFromActionSheet,
		onRenameFromActionSheet,
		onSelectFromActionSheet,
		onRenameListItem,
		onRenameValueChange,
		onScan,
		onSearchSelect,
		onImagePlacementSave,
	}: IngredientRoutePopinsProps = $props();
</script>

<IngredientActionSheet
	open={actionSheetItem !== null}
	title={actionSheetItem?.food.description ?? ""}
	removeLabel={actionSheetItem
		? `Remove from ${getIngredientListLabel(actionSheetItem.key)}`
		: ""}
	removing={removingItem !== null}
	canAdjustImagePlacement={canAdjustImagePlacement &&
		Boolean(actionSheetItem?.food.image?.sourceReference)}
	onClose={onCloseActionSheet}
	onSelectItem={onSelectFromActionSheet}
	onAdjustImagePlacement={onAdjustImagePlacementFromActionSheet}
	onRename={onRenameFromActionSheet}
	onRemove={onRemoveFromActionSheet}
/>

<IngredientImagePlacementSheet
	open={imagePlacementItem !== null}
	food={imagePlacementItem?.food ?? null}
	{canAdjustImagePlacement}
	onClose={onCloseImagePlacement}
	{onImagePlacementSave}
/>

<ManualEntrySheet
	open={activeSheet === "manual-entry"}
	{scanSignal}
	onClose={onCloseIngredientSheet}
	onScannerClose={onCloseBarcodeScanner}
	{moveConfirmationRouteOpen}
	onMoveConfirmationOpen={onOpenMoveConfirmation}
	onMoveConfirmationClose={onCloseMoveConfirmation}
	onCreate={onCreateManualIngredient}
	{onLookupStateChange}
/>

<IngredientFilterSheet
	open={activeSheet === "filters"}
	query={listQuery}
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
	confirmLabel="Save name"
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
		{destinationListKey}
		{destinationListFoodIdentityKeys}
		{otherListFoodIdentityKeys}
		{provenanceOptions}
		{onScan}
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
			{listMembership}
			{canAdjustImagePlacement}
			{onImagePlacementSave}
			{provenanceOptions}
			onClose={onCloseNutrition}
			onReportIncorrectInformation={onOpenCorrection}
		/>
	{/if}
</RightSheet>

<ManualEntrySheet
	open={correctionFood !== null}
	initialFood={correctionFood ?? undefined}
	submissionIntent="catalog_correction"
	catalogSubmissionOnly
	onClose={onCloseCorrection}
	onCreate={onCreateManualIngredient}
	{onLookupStateChange}
/>
