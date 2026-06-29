<script lang="ts">
	import Sliders from "$lib/assets/icons/Sliders.svelte";
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
		onScan,
		onFilter,
	}: {
		scanning?: boolean;
		filtersActive?: boolean;
		onSelect: (food: FdcFood) => void;
		onScan: () => void;
		onFilter: () => void;
	} = $props();
</script>

<ViewFrame className="ingredient-search-view">
	<ViewTop>
		<ViewHeader
			title="Ingredients"
			titleId="ingredient-search-view-title"
			subtitle="Search foods, add them to your fridge, and track shopping needs."
		/>
	</ViewTop>

	<ViewBody>
		<IngredientSearch autofocus {onSelect} onSearchFocus={() => {}}>
			{#snippet actions()}
				<BarcodeScanButton scanning={scanning} compact onclick={onScan} />
				<button
					class="ingredient-search-view__filter"
					class:ingredient-search-view__filter--active={filtersActive}
					type="button"
					aria-label="Filter saved ingredients"
					aria-expanded={filtersActive}
					aria-controls="ingredient-filter-sheet-title"
					onclick={onFilter}
				>
					<Sliders class="ingredient-search-view__filter-icon" />
				</button>
			{/snippet}
		</IngredientSearch>
	</ViewBody>
</ViewFrame>

<style lang="scss">
	@use "../../../../styles/variables" as *;

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

	.ingredient-search-view__filter {
		display: inline-grid;
		place-items: center;
		width: $ingredient-control-height;
		height: $ingredient-control-height;
		color: $ingredient-text-muted;
		background: $ingredient-surface-control;
		border: 0;
		border-radius: $ingredient-radius-control;
		transition:
			color 160ms ease,
			background-color 160ms ease,
			transform 160ms ease;

		&:hover,
		&--active {
			color: $ingredient-accent-primary;
			background: $ingredient-surface-positive;
		}

		&:active {
			transform: scale(0.97);
		}

		&:focus-visible {
			outline: $app-focus-outline;
			outline-offset: $app-gap-xs;
		}
	}

	:global(.ingredient-search-view__filter-icon) {
		width: $ingredient-control-icon-size;
		height: $ingredient-control-icon-size;
	}
</style>
