<script lang="ts">
	import IngredientCard from "$lib/components/mix/ingredients/IngredientCard/IngredientCard.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import MixEmptyState from "$lib/components/mix/states/MixEmptyState/MixEmptyState.svelte";
	import type { SelectedIngredientsPanelProps } from "./types";
	import ListControls from "$lib/components/common/lists/ListControls/ListControls.svelte";
	import PaginatedListControls from "$lib/components/common/navigation/PaginatedListControls/PaginatedListControls.svelte";
	import {
		filterItemsByQuery,
	} from "$lib/utils/list/listNavigation";
	import {
		getFoodNutrientChips,
		getFoodSourceLabel,
		getServingConversionBasis,
		getServingGramsLabel,
	} from "$lib/utils/mix/ui/mixUi";
	import {
		LIST_PAGE_SIZES,
		LIST_SEARCH_THRESHOLDS,
	} from "$lib/config/listPagination";

	let {
		selectedFoods,
		fridgeItems,
		selectedNutrients,
		servingGrams,
		getServingQuantity,
		getServingUnit,
		getServingConversion,
		getServingConversionWarning,
		conversionDetailsFoodId = null,
		onOpenConversionDetails,
		onCloseConversionDetails,
		onRemove,
		onServingChange,
		open = true,
		onOpenChange,
	}: SelectedIngredientsPanelProps = $props();

	let query = $state("");
	let visibleCount = $state<number>(LIST_PAGE_SIZES.selectedIngredients);
	let listElement = $state<HTMLElement | null>(null);
	const filteredFoods = $derived(
		filterItemsByQuery(
			selectedFoods,
			query,
			(food) =>
				[food.description, food.brandOwner, food.foodCategory]
					.filter(Boolean)
					.join(" "),
		),
	);
	const visibleFoods = $derived(filteredFoods.slice(0, visibleCount));
	const hasMoreFoods = $derived(visibleFoods.length < filteredFoods.length);

	const updateQuery = (value: string) => {
		query = value;
		visibleCount = LIST_PAGE_SIZES.selectedIngredients;
	};

	const revealMoreFoods = () => {
		visibleCount = Math.min(
			visibleCount + LIST_PAGE_SIZES.ingredientLoadMore,
			filteredFoods.length,
		);
	};
</script>

<section class="selected-ingredients-panel" aria-label="Selected ingredients">
	<CollapsibleSection
		title="Selected ingredients"
		badge={`${selectedFoods.length}`}
		{open}
		{onOpenChange}
		surface="panel"
	>
		<div class="selected-ingredients-panel__content">
			{#if selectedFoods.length === 0}
				<MixEmptyState />
			{:else}
				<p class="selected-ingredients-panel__help">Adjust amounts to update the chart.</p>
				{#if selectedFoods.length >= LIST_SEARCH_THRESHOLDS.selectedIngredients || query}
					<ListControls
						id="selected-ingredient-search"
						{query}
						onQueryChange={updateQuery}
						placeholder="Find a selected ingredient…"
						label="Find selected ingredients"
						totalCount={selectedFoods.length}
						visibleCount={filteredFoods.length}
						itemLabel="selected"
						showCount={Boolean(query)}
					/>
				{/if}
				<div
					class="selected-ingredient-cards"
					bind:this={listElement}
					aria-label="Selected Mix ingredients"
					data-tutorial-target="mix-selected-ingredients"
				>
					{#each visibleFoods as food (food.fdcId)}
						{@const servingConversion = getServingConversion(food)}
						{@const servingQuantity = getServingQuantity(food)}
						{@const servingUnit = getServingUnit(food)}
						<IngredientCard
							{food}
							sourceLabel={getFoodSourceLabel(food, fridgeItems)}
							quantity={servingQuantity}
							unit={servingUnit}
							gramsLabel={servingUnit === "g"
								? null
								: getServingGramsLabel(servingConversion)}
							conversionBasis={getServingConversionBasis(servingConversion)}
							warning={getServingConversionWarning(food)}
							conversionDetailsOpen={conversionDetailsFoodId === food.fdcId}
							{onOpenConversionDetails}
							{onCloseConversionDetails}
							nutrientChips={getFoodNutrientChips(
								food,
								selectedNutrients,
								servingGrams,
							)}
							onRemove={onRemove}
							onServingChange={onServingChange}
						/>
					{/each}
					<PaginatedListControls
						scrollContainer={listElement}
						hasMoreItems={hasMoreFoods}
						loadMoreLabel="Load more selected ingredients"
						contentVersion={`${query}:${visibleFoods.length}:${selectedFoods.length}`}
						containerElement="div"
						onLoadMore={revealMoreFoods}
					/>
				</div>
				{#if filteredFoods.length === 0}
					<p class="no-results">No selected ingredients match that search.</p>
				{/if}
			{/if}
		</div>
	</CollapsibleSection>
</section>

<style lang="scss">
	@use "./SelectedIngredientsPanel.scss";
</style>
