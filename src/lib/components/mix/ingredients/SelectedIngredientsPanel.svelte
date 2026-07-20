<script lang="ts">
	import IngredientCard from "$lib/components/mix/ingredients/IngredientCard.svelte";
	import type { SelectedIngredientsPanelProps } from "$lib/components/mix/types";
	import ListControls from "$lib/components/common/lists/ListControls.svelte";
	import Pagination from "$lib/components/common/lists/Pagination.svelte";
	import {
		clampPage,
		filterItemsByQuery,
		paginateItems,
	} from "$lib/utils/list/listNavigation";
	import {
		getFoodNutrientChips,
		getFoodSourceLabel,
		getServingGramsLabel,
	} from "$lib/utils/mix/ui/mixUi";
	import {
		LIST_PAGE_SIZES,
		LIST_SEARCH_THRESHOLDS,
	} from "../../../../defaults/listDefaults";

	let {
		selectedFoods,
		fridgeItems,
		selectedNutrients,
		servingGrams,
		getServingQuantity,
		getServingUnit,
		getServingConversion,
		getServingConversionWarning,
		onRemove,
		onServingChange,
	}: SelectedIngredientsPanelProps = $props();

	let query = $state("");
	let page = $state(1);
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
	const pagedFoods = $derived(
		paginateItems(
			filteredFoods,
			page,
			LIST_PAGE_SIZES.selectedIngredients,
		),
	);

	const updateQuery = (value: string) => {
		query = value;
		page = 1;
	};

	$effect(() => {
		page = clampPage(
			page,
			filteredFoods.length,
			LIST_PAGE_SIZES.selectedIngredients,
		);
	});
</script>

<section class="selected-ingredients-panel" aria-label="Selected ingredients">
	<div class="selected-ingredients-header">
		<div>
			<h4>Selected Ingredients</h4>
			<p>Adjust amounts here. The graph updates from these values.</p>
		</div>
	</div>
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
		/>
	{/if}
	<div class="selected-ingredient-cards">
		{#each pagedFoods as food (food.fdcId)}
			<IngredientCard
				{food}
				sourceLabel={getFoodSourceLabel(food, fridgeItems)}
				quantity={getServingQuantity(food)}
				unit={getServingUnit(food)}
				gramsLabel={getServingGramsLabel(getServingConversion(food))}
				warning={getServingConversionWarning(food)}
				nutrientChips={getFoodNutrientChips(
					food,
					selectedNutrients,
					servingGrams,
				)}
				onRemove={onRemove}
				onServingChange={onServingChange}
			/>
		{/each}
	</div>
	{#if filteredFoods.length === 0}
		<p class="no-results">No selected ingredients match that search.</p>
	{/if}
	<Pagination
		{page}
		pageSize={LIST_PAGE_SIZES.selectedIngredients}
		totalItems={filteredFoods.length}
		onPageChange={(nextPage) => (page = nextPage)}
		label="Selected ingredients"
	/>
</section>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.selected-ingredients-panel {
		display: grid;
		gap: $app-gap-sm;
		padding: $app-gap-sm;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-card-radius;

		h4 {
			color: $app-primary;
			font-size: $app-font-size-lg;
			font-weight: $app-font-weight-bold;
		}

		p {
			color: $app-muted;
			font-size: $app-font-size-sm;
		}
	}

	.selected-ingredients-header {
		display: flex;
		justify-content: space-between;
		gap: $app-gap-sm;
	}

	.selected-ingredient-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax($mix-selected-ingredient-card-min-width, 1fr));
		gap: $app-gap-sm;
		max-height: min(52vh, $mix-selected-ingredient-list-max-height);
		overflow-y: auto;
		overscroll-behavior: contain;
		padding-right: $app-gap-inline-compact;
	}

	.no-results {
		padding: $app-gap-sm;
		text-align: center;
	}

	@media (max-width: $app-breakpoint-md) {
		.selected-ingredient-cards {
			grid-template-columns: 1fr;
			max-height: 42vh;
		}
	}
</style>
