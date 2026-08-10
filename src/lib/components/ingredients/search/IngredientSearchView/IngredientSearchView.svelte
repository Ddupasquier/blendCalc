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
	import IngredientSearch from "../IngredientSearch/IngredientSearch.svelte";

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
	@use "./IngredientSearchView.scss";
</style>
