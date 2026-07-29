<script lang="ts">
	import Sliders from "$lib/assets/icons/Sliders/Sliders.svelte";
	import BarcodeScanButton from "$lib/components/ingredients/barcode/BarcodeScanButton/BarcodeScanButton.svelte";
	import IconControlButton from "$lib/components/common/buttons/IconControlButton/IconControlButton.svelte";
	import IngredientSearchTrigger from "$lib/components/ingredients/search/IngredientSearchTrigger/IngredientSearchTrigger.svelte";
	import ManualEntryLauncher from "$lib/components/ingredients/manual-entry/ManualEntryLauncher/ManualEntryLauncher.svelte";
	import type { IngredientsSearchPanelProps } from "./types";

	let {
		barcodeLookupBusy = false,
		filtersActive = false,
		onOpenSearch,
		onScan,
		onToggleFilters,
		onOpenManualEntry,
	}: IngredientsSearchPanelProps = $props();
</script>

<section
	class="ingredient-search-panel"
	aria-labelledby="ingredient-search-title"
>
	<h2 id="ingredient-search-title" class="sr-only">Find Ingredients</h2>
	<div class="search-toolbar">
		<div class="search-toolbar__input">
			<IngredientSearchTrigger onOpen={onOpenSearch} />
		</div>
		<BarcodeScanButton scanning={barcodeLookupBusy} compact onclick={onScan} />
		<IconControlButton
			class="filter-button"
			label="Sort saved ingredients"
			active={filtersActive}
			aria-expanded={filtersActive}
			aria-controls="ingredient-filter-sheet-title"
			onclick={onToggleFilters}
		>
			<Sliders class="filter-button__icon" />
		</IconControlButton>
		<ManualEntryLauncher onSelect={onOpenManualEntry} />
	</div>
</section>

<style lang="scss">
	@use "./IngredientsSearchPanel.scss";
</style>
