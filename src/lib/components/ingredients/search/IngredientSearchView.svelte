<script lang="ts">
	import BackButton from "$lib/components/common/buttons/BackButton.svelte";
	import Sliders from "$lib/assets/icons/Sliders.svelte";
	import IconControlButton from "$lib/components/common/buttons/IconControlButton.svelte";
	import ViewBody from "$lib/components/common/view/ViewBody.svelte";
	import ViewFrame from "$lib/components/common/view/ViewFrame.svelte";
	import ViewHeader from "$lib/components/common/view/ViewHeader.svelte";
	import ViewTop from "$lib/components/common/view/ViewTop.svelte";
	import BarcodeScanButton from "$lib/components/ingredients/barcode/BarcodeScanButton.svelte";
	import type { FdcFood } from "$lib/utils/food/types";
	import IngredientSearch from "./IngredientSearch.svelte";

	let {
		scanning = false,
		filtersActive = false,
		onSelect,
		onAdd,
		addingFoodId = null,
		onScan,
		onFilter,
		onClose,
	}: {
		scanning?: boolean;
		filtersActive?: boolean;
		onSelect: (food: FdcFood) => void;
		onAdd: (food: FdcFood) => void | Promise<void>;
		addingFoodId?: number | null;
		onScan: () => void;
		onFilter: () => void;
		onClose: () => void;
	} = $props();
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
		<IngredientSearch autofocus {onSelect} {onAdd} {addingFoodId} onSearchFocus={() => {}}>
			{#snippet actions()}
				<BarcodeScanButton scanning={scanning} compact onclick={onScan} />
				<IconControlButton
					class="ingredient-search-view__filter"
					label="Filter saved ingredients"
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
		margin-top: 0.05rem;
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
		padding-bottom: $app-vertical-stack-gap;
	}

	:global(.ingredient-search-view .barcode-scan-button--compact) {
		width: $ingredient-control-height;
		height: $ingredient-control-height;
		min-height: $ingredient-control-height;
	}

	:global(.ingredient-search-view__filter-icon) {
		width: $ingredient-control-icon-size;
		height: $ingredient-control-icon-size;
	}
</style>
