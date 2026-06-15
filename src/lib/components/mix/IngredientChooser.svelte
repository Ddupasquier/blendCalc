<script lang="ts">
	import PillRow from "$lib/components/common/PillRow.svelte";
	import ListControls from "$lib/components/common/ListControls.svelte";
	import Pagination from "$lib/components/common/Pagination.svelte";
	import SortSelect from "$lib/components/common/SortSelect.svelte";
	import type { FdcFood } from "$lib/utils/food/types";
	import {
		clampPage,
		FOOD_LIST_SORT_OPTIONS,
		filterItemsByQuery,
		paginateItems,
		sortFoodListItems,
		type FoodListSort,
	} from "$lib/utils/list/listNavigation";
	import { LIST_PAGE_SIZES } from "../../../defaults/listDefaults";

	let {
		fridgeItems,
		shoppingItems,
		selectedFoodIds,
		onToggleFood,
	}: {
		fridgeItems: FdcFood[];
		shoppingItems: FdcFood[];
		selectedFoodIds: number[];
		onToggleFood: (foodId: number) => void;
	} = $props();

	let query = $state("");
	let filter = $state("all");
	let sort = $state<FoodListSort>("recent");
	let fridgePage = $state(1);
	let shoppingPage = $state(1);

	const filterOptions = [
		{ value: "all", label: "All ingredients" },
		{ value: "selected", label: "Selected only" },
		{ value: "custom", label: "Custom only" },
	];

	const filterFoods = (foods: FdcFood[]) => {
		const filteredFoods = filterItemsByQuery(
			foods.filter((food) => {
				if (filter === "selected") {
					return selectedFoodIds.includes(food.fdcId);
				}
				if (filter === "custom") return food.customFood === true;
				return true;
			}),
			query,
			(food) =>
				[food.description, food.brandOwner, food.foodCategory]
					.filter(Boolean)
					.join(" "),
		);

		return sortFoodListItems(
			filteredFoods,
			sort,
			(food) => food.description,
			(food) => food.listAddedAt,
		);
	};

	const filteredFridgeItems = $derived.by(() => filterFoods(fridgeItems));
	const filteredShoppingItems = $derived.by(() => filterFoods(shoppingItems));
	const pagedFridgeItems = $derived(
		paginateItems(
			filteredFridgeItems,
			fridgePage,
			LIST_PAGE_SIZES.mixChooser,
		),
	);
	const pagedShoppingItems = $derived(
		paginateItems(
			filteredShoppingItems,
			shoppingPage,
			LIST_PAGE_SIZES.mixChooser,
		),
	);

	const getActiveIndices = (items: FdcFood[]) => {
		return items
			.map((food, index) =>
				selectedFoodIds.includes(food.fdcId) ? index : -1,
			)
			.filter((index) => index !== -1);
	};

	const getCustomIndices = (items: FdcFood[]) => {
		return items
			.map((food, index) => (food.customFood ? index : -1))
			.filter((index) => index !== -1);
	};

	const updateQuery = (value: string) => {
		query = value;
		fridgePage = 1;
		shoppingPage = 1;
	};

	const updateFilter = (value: string) => {
		filter = value;
		fridgePage = 1;
		shoppingPage = 1;
	};

	const updateSort = (value: string) => {
		sort = value as FoodListSort;
		fridgePage = 1;
		shoppingPage = 1;
	};

	$effect(() => {
		fridgePage = clampPage(
			fridgePage,
			filteredFridgeItems.length,
			LIST_PAGE_SIZES.mixChooser,
		);
		shoppingPage = clampPage(
			shoppingPage,
			filteredShoppingItems.length,
			LIST_PAGE_SIZES.mixChooser,
		);
	});
</script>

<section class="setup-card setup-card--ingredients">
	<div class="section-heading">
		<h4>Choose Ingredients</h4>
		<p>Select items from your fridge or shopping list.</p>
	</div>
	<div class="ingredient-list-controls">
		<ListControls
			id="mix-ingredient-search"
			{query}
			onQueryChange={updateQuery}
			placeholder="Find an ingredient to add or remove…"
			label="Find ingredients"
			totalCount={fridgeItems.length + shoppingItems.length}
			visibleCount={filteredFridgeItems.length + filteredShoppingItems.length}
			itemLabel="ingredients"
			filterLabel="Show"
			filterValue={filter}
			filterOptions={filterOptions}
			onFilterChange={updateFilter}
		/>
		<SortSelect
			id="mix-ingredient-sort"
			value={sort}
			options={FOOD_LIST_SORT_OPTIONS}
			onChange={updateSort}
		/>
	</div>
	<div class="ingredient-lists" aria-label="Smoothie ingredients">
		<section class="ingredient-list">
			<h5>Fridge <span>{filteredFridgeItems.length}</span></h5>
			{#if pagedFridgeItems.length > 0}
				<PillRow
					pills={pagedFridgeItems.map((food) => food.description)}
					onRemove={(index) => onToggleFood(pagedFridgeItems[index].fdcId)}
					onSelect={(index) => onToggleFood(pagedFridgeItems[index].fdcId)}
					activeIndices={getActiveIndices(pagedFridgeItems)}
					customIndices={getCustomIndices(pagedFridgeItems)}
					preserveOrder
				/>
				<Pagination
					page={fridgePage}
					pageSize={LIST_PAGE_SIZES.mixChooser}
					totalItems={filteredFridgeItems.length}
					onPageChange={(page) => (fridgePage = page)}
					label="Mix fridge ingredients"
				/>
			{:else if fridgeItems.length > 0}
				<p>No fridge ingredients match these filters.</p>
			{:else}
				<p>No fridge items yet.</p>
			{/if}
		</section>

		<section class="ingredient-list">
			<h5>Shopping List <span>{filteredShoppingItems.length}</span></h5>
			{#if pagedShoppingItems.length > 0}
				<PillRow
					pills={pagedShoppingItems.map((food) => food.description)}
					onRemove={(index) => onToggleFood(pagedShoppingItems[index].fdcId)}
					onSelect={(index) => onToggleFood(pagedShoppingItems[index].fdcId)}
					activeIndices={getActiveIndices(pagedShoppingItems)}
					customIndices={getCustomIndices(pagedShoppingItems)}
					preserveOrder
				/>
				<Pagination
					page={shoppingPage}
					pageSize={LIST_PAGE_SIZES.mixChooser}
					totalItems={filteredShoppingItems.length}
					onPageChange={(page) => (shoppingPage = page)}
					label="Mix shopping-list ingredients"
				/>
			{:else if shoppingItems.length > 0}
				<p>No shopping-list ingredients match these filters.</p>
			{:else}
				<p>No shopping list items yet.</p>
			{/if}
		</section>
	</div>
</section>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.setup-card {
		padding: $app-gap-sm;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-card-radius;
	}

	.section-heading {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: $app-gap-sm;
		margin-bottom: $app-gap-sm;

		h4 {
			color: $app-primary;
			font-size: $app-font-size-lg;
			font-weight: 800;
		}

		p {
			color: $app-muted;
			font-size: $app-font-size-sm;
			line-height: 1.35;
		}
	}

	.ingredient-list-controls {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(10rem, auto);
		align-items: end;
		gap: $app-gap-sm;
		margin-bottom: $app-gap-sm;
	}

	.ingredient-lists {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: $app-gap-sm;
	}

	.ingredient-list {
		min-width: 0;
		padding: 0;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-card-radius;

		h5 {
			display: flex;
			align-items: center;
			gap: $app-gap-xs;
			margin: 0 0 0.35rem;
			padding: 0.45rem;
			color: $app-primary;
			background: $app-section-bg;
			border-bottom: $app-border;
			font-size: $app-font-size-sm;
			font-weight: 800;

			span {
				padding: 0.06rem 0.35rem;
				color: $app-muted;
				background: $app-accent;
				border-radius: $app-radius-pill;
				font-size: $app-font-size-xs;
			}
		}

		p {
			padding: 0 0.45rem 0.45rem;
			color: $app-muted;
			font-size: $app-font-size-sm;
		}

		:global(.pill-row) {
			gap: 0.3rem;
			margin: 0;
			padding: 0 0.45rem 0.45rem;
		}

		:global(.pill) {
			max-width: 100%;
			padding: 0.16rem 0.55rem;
			font-size: $app-font-size-sm;
			line-height: $app-button-line-height;
			overflow-wrap: anywhere;
		}

		:global(.pill-remove) {
			flex-shrink: 0;
			font-size: 1rem;
		}
	}

	@media (max-width: $app-breakpoint-md) {
		.ingredient-lists {
			grid-template-columns: 1fr;
		}

		.section-heading {
			display: grid;
		}

		.ingredient-list-controls {
			grid-template-columns: 1fr;
		}
	}
</style>
