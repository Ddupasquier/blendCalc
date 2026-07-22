<script lang="ts">
	import BackButton from "$lib/components/common/buttons/BackButton.svelte";
	import Sliders from "$lib/assets/icons/Sliders.svelte";
	import IconControlButton from "$lib/components/common/buttons/IconControlButton.svelte";
	import ViewBody from "$lib/components/common/view/ViewBody.svelte";
	import ViewFrame from "$lib/components/common/view/ViewFrame.svelte";
	import ViewHeader from "$lib/components/common/view/ViewHeader.svelte";
	import ViewTop from "$lib/components/common/view/ViewTop.svelte";
	import BarcodeScanButton from "$lib/components/ingredients/barcode/BarcodeScanButton.svelte";
	import type { IngredientSearchViewProps } from "$lib/components/ingredients/search/types";
	import IngredientSearch from "./IngredientSearch.svelte";

	let {
		scanning = false,
		filtersActive = false,
		onSelect,
		onAdd,
		addingFoodId = null,
		savedFoodIdentityKeys = new Set<string>(),
		provenanceOptions = [],
		sourceFilter = "all",
		trustFilter = "any",
		onScan,
		onFilter,
		onClose,
	}: IngredientSearchViewProps = $props();
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
				subtitle="Search foods, add them to your fridge, and track shopping needs."
			/>
		</div>
	</ViewTop>

	<ViewBody>
		<IngredientSearch
			autofocus
			{onSelect}
			{onAdd}
			{addingFoodId}
			{savedFoodIdentityKeys}
			{provenanceOptions}
			{sourceFilter}
			{trustFilter}
			onSearchFocus={() => {}}
		>
			{#snippet actions()}
				<BarcodeScanButton scanning={scanning} compact onclick={onScan} />
				<IconControlButton
					class="ingredient-search-view__filter"
					label="Sort ingredients"
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
	@use "../../../../styles/variables" as *;

	.ingredient-search-view__header {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: start;
		gap: $app-gap-sm;
	}

	:global(.ingredient-search-view__back) {
		margin-top: 0;
	}

	:global(.ingredient-search-view .search-wrap) {
		display: grid;
		grid-template-rows: auto auto auto minmax(0, 1fr);
		height: 100%;
		min-height: 0;
		align-content: stretch;
	}

	:global(.ingredient-search-view .results-panel) {
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding-bottom: $app-gap-md;
	}

	:global(.ingredient-search-view .barcode-scan-button--compact) {
		width: $app-shell-control-height;
		height: $app-shell-control-height;
		min-height: $app-shell-control-height;
	}

	:global(.ingredient-search-view__filter-icon) {
		width: $app-shell-control-icon-size;
		height: $app-shell-control-icon-size;
	}
</style>
