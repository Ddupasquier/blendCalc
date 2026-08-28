<script lang="ts">
	import BackButton from "$lib/components/common/buttons/BackButton/BackButton.svelte";
	import Sliders from "$lib/assets/icons/Sliders/Sliders.svelte";
	import IconControlButton from "$lib/components/common/buttons/IconControlButton/IconControlButton.svelte";
	import ViewBody from "$lib/components/common/view/ViewBody/ViewBody.svelte";
	import ViewFrame from "$lib/components/common/view/ViewFrame/ViewFrame.svelte";
	import ViewHeader from "$lib/components/common/view/ViewHeader/ViewHeader.svelte";
	import ViewTop from "$lib/components/common/view/ViewTop/ViewTop.svelte";
	import BarcodeScanButton from "$lib/components/ingredients/barcode/BarcodeScanButton/BarcodeScanButton.svelte";
	import type { IngredientSearchViewProps } from "./types";
	import { getIngredientListLabel } from "$lib/utils/ingredients/ingredientListUi";
	import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
	import IngredientSearch from "../IngredientSearch/IngredientSearch.svelte";

	let {
		scanning = false,
		filtersActive = false,
		onSelect,
		onAdd,
		addingFoodId = null,
		destinationListKey = MIX_STORAGE_KEYS.fridge,
		destinationListFoodIdentityKeys = new Set<string>(),
		otherListFoodIdentityKeys = new Set<string>(),
		provenanceOptions = [],
		sourceFilter = "all",
		trustFilter = "any",
		safetyFilter = "all",
		onScan,
		onFilter,
		onClose,
	}: IngredientSearchViewProps = $props();

	const destinationListLabel = $derived(
		getIngredientListLabel(destinationListKey),
	);
</script>

<ViewFrame className="ingredient-search-view">
	<ViewTop>
		<div class="ingredient-search-view__header">
			<BackButton
				class="ingredient-search-view__back"
				label="Back to ingredients"
				variant="ghost"
				size="small"
				onclick={onClose}
			/>
			<ViewHeader
				title="Ingredients"
				titleId="ingredient-search-view-title"
				subtitle={`Search foods and place them directly in your ${destinationListLabel}.`}
			/>
		</div>
	</ViewTop>

	<ViewBody>
		<IngredientSearch
			autofocus
			{onSelect}
			{onAdd}
			{addingFoodId}
			{destinationListKey}
			{destinationListFoodIdentityKeys}
			{otherListFoodIdentityKeys}
			{provenanceOptions}
			{sourceFilter}
			{trustFilter}
			{safetyFilter}
			onSearchFocus={() => {}}
		>
			{#snippet actions()}
				<BarcodeScanButton {scanning} compact onclick={onScan} />
				<IconControlButton
					class="ingredient-search-view__filter"
					label="Filter and sort ingredients"
					active={filtersActive}
					aria-expanded={filtersActive}
					aria-controls="ingredient-filter-sheet-title"
					onclick={onFilter}
				>
					<Sliders class="ingredient-search-view__filter-icon" />
				</IconControlButton>
			{/snippet}
		</IngredientSearch>
	</ViewBody>
</ViewFrame>

<style lang="scss">
	@use "./IngredientSearchView.scss";
</style>
