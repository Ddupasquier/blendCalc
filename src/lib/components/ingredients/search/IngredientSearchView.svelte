<script lang="ts">
	import Sliders from "$lib/assets/icons/Sliders.svelte";
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

<div class="ingredient-search-view">
	<header class="ingredient-search-view__header">
		<h1 id="ingredient-search-view-title">Ingredients</h1>
		<p>Search foods, add them to your fridge, and track shopping needs.</p>
	</header>

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
</div>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.ingredient-search-view {
		display: grid;
		align-content: start;
		gap: $app-vertical-stack-gap;
		min-height: 100%;
	}

	.ingredient-search-view__header {
		h1 {
			margin: 0 0 $app-gap-xs;
			color: $ingredient-text-primary;
			font-family: $app-font-family-display;
			font-size: clamp(1.75rem, 7vw, 2.1rem);
			font-weight: $app-font-weight-heavy;
			letter-spacing: -0.05em;
			line-height: 0.98;
		}

		p {
			max-width: 24rem;
			color: $ingredient-text-muted;
			font-size: $app-font-size-md;
			font-weight: $app-font-weight-medium;
			line-height: 1.35;
		}
	}

	.ingredient-search-view :global(.barcode-scan-button--compact) {
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
