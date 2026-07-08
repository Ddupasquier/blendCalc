<script lang="ts">
	import Sliders from "$lib/assets/icons/Sliders.svelte";
	import BarcodeScanButton from "$lib/components/ingredients/barcode/BarcodeScanButton.svelte";
	import IconControlButton from "$lib/components/common/buttons/IconControlButton.svelte";
	import IngredientSearchTrigger from "$lib/components/ingredients/search/IngredientSearchTrigger.svelte";
	import ManualEntryLauncher from "$lib/components/ingredients/manual-entry/ManualEntryLauncher.svelte";
	import type { IngredientsSearchPanelProps } from "$lib/components/ingredients/page/types";

	let {
		barcodeLookupBusy = false,
		filtersActive = false,
		onOpenSearch,
		onScan,
		onToggleFilters,
		onOpenManualEntry,
	}: IngredientsSearchPanelProps = $props();
</script>

<section class="ingredient-search-panel" aria-labelledby="ingredient-search-title">
	<h2 id="ingredient-search-title" class="sr-only">Find Ingredients</h2>
	<div class="search-toolbar">
		<div class="search-toolbar__input">
			<IngredientSearchTrigger onOpen={onOpenSearch} />
		</div>
		<BarcodeScanButton scanning={barcodeLookupBusy} compact onclick={onScan} />
		<IconControlButton
			class="filter-button"
			label="Filter saved ingredients"
			active={filtersActive}
			aria-expanded={filtersActive}
			aria-controls="ingredient-filter-sheet-title"
			onclick={onToggleFilters}
		>
			<Sliders class="filter-button__icon" />
		</IconControlButton>
	</div>

	<ManualEntryLauncher onSelect={onOpenManualEntry} />
</section>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.ingredient-search-panel {
		position: relative;
		z-index: 2;
		display: grid;
		gap: $app-vertical-stack-gap;
		min-height: 0;
		margin-bottom: 0;
		background: transparent;
		border: 0;
	}

	.search-toolbar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) $ingredient-control-height $ingredient-control-height;
		align-items: center;
		gap: $app-horizontal-control-gap;
	}

	.search-toolbar__input {
		min-width: 0;
	}

	.search-toolbar :global(.barcode-scan-button--compact) {
		width: $ingredient-control-height;
		height: $ingredient-control-height;
		min-height: $ingredient-control-height;
	}

	:global(.filter-button__icon) {
		width: $ingredient-control-icon-size;
		height: $ingredient-control-icon-size;
	}

	@media (max-width: $app-breakpoint-xs) {
		.search-toolbar {
			gap: $app-horizontal-control-gap;
		}
	}
</style>
