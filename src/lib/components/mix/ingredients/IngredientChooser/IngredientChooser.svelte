<script lang="ts">
	import ListControls from "$lib/components/common/lists/ListControls/ListControls.svelte";
	import ListSortSheet from "$lib/components/common/lists/ListSortSheet/ListSortSheet.svelte";
	import PaginatedListControls from "$lib/components/common/navigation/PaginatedListControls/PaginatedListControls.svelte";
	import SegmentedControl from "$lib/components/common/buttons/SegmentedControl/SegmentedControl.svelte";
	import MixIngredientOption from "$lib/components/mix/ingredients/MixIngredientOption/MixIngredientOption.svelte";
	import MixPanelSection from "$lib/components/mix/layout/MixPanelSection/MixPanelSection.svelte";
	import type { IngredientChooserProps } from "./types";
	import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
	import {
		FOOD_LIST_SORT_OPTIONS,
		filterItemsByQuery,
		sortFoodListItems,
		type FoodListSort,
	} from "$lib/utils/list/listNavigation";
	import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
	import { LIST_PAGE_SIZES } from "$lib/config/listPagination";
	import { isPrivateCustomFood } from "$lib/utils/food/records/foodClassification";

	let {
		fridgeItems,
		shoppingItems,
		selectedFoodIds,
		onToggleFood,
		open = true,
		onOpenChange,
		filtersOpen = false,
		onOpenFilters = () => {},
		onCloseFilters = () => {},
	}: IngredientChooserProps = $props();

	let activeListKey = $state<SmoothieListKey>(MIX_STORAGE_KEYS.fridge);
	let query = $state("");
	let filter = $state("all");
	let sort = $state<FoodListSort>("recent");
	let visibleCount = $state<number>(LIST_PAGE_SIZES.mixChooser);
	let listElement = $state<HTMLElement | null>(null);

	const activeItems = $derived(
		activeListKey === MIX_STORAGE_KEYS.fridge ? fridgeItems : shoppingItems,
	);
	const filteredItems = $derived.by(() => {
		const filtered = filterItemsByQuery(
			activeItems.filter((food) => {
				if (filter === "selected") return selectedFoodIds.includes(food.fdcId);
				if (filter === "custom") return isPrivateCustomFood(food);
				return true;
			}),
			query,
			(food) =>
				[food.description, food.brandOwner, food.foodCategory]
					.filter(Boolean)
					.join(" "),
		);
		return sortFoodListItems(
			filtered,
			sort,
			(food) => food.description,
			(food) => food.listAddedAt,
		);
	});
	const visibleItems = $derived(filteredItems.slice(0, visibleCount));
	const hasMoreItems = $derived(visibleItems.length < filteredItems.length);
	const selectedInActiveList = $derived(
		activeItems.filter((food) => selectedFoodIds.includes(food.fdcId)).length,
	);
	const tabs = $derived([
		{
			value: MIX_STORAGE_KEYS.fridge,
			label: "Fridge",
			count: fridgeItems.length,
		},
		{
			value: MIX_STORAGE_KEYS.shoppingList,
			label: "Shopping List",
			count: shoppingItems.length,
		},
	]);
	const filterOptions = [
		{ value: "all", label: "All ingredients" },
		{ value: "selected", label: "Selected only" },
		{ value: "custom", label: "Custom only" },
	];

	const resetVisibleItems = () => (visibleCount = LIST_PAGE_SIZES.mixChooser);
	const revealMoreItems = () => {
		visibleCount = Math.min(
			visibleCount + LIST_PAGE_SIZES.ingredientLoadMore,
			filteredItems.length,
		);
	};
	const setActiveList = (value: string) => {
		activeListKey = value as SmoothieListKey;
		resetVisibleItems();
		requestAnimationFrame(() => {
			listElement?.scrollTo({ top: 0, behavior: "auto" });
		});
	};
	const applyListControls = (nextSort: string, nextFilter?: string) => {
		sort = nextSort as FoodListSort;
		filter = nextFilter ?? filter;
		resetVisibleItems();
		onCloseFilters();
	};
</script>

<ListSortSheet
	open={filtersOpen}
	title="Filter and sort ingredients"
	titleId="mix-ingredient-filter-sheet-title"
	label="Filter and sort ingredients available to this mix"
	value={sort}
	options={FOOD_LIST_SORT_OPTIONS}
	filterValue={filter}
	{filterOptions}
	onApply={applyListControls}
	onClose={onCloseFilters}
/>

<MixPanelSection
	class="ingredient-chooser"
	ariaLabel="Add ingredients"
	title="Add ingredients"
	titleId="add-ingredients-title"
	{open}
	{onOpenChange}
>
	<div class="ingredient-chooser__content">
		<SegmentedControl
			label="Ingredient source"
			options={tabs}
			value={activeListKey}
			onSelect={setActiveList}
		/>
		<ListControls
			id="mix-ingredient-search"
			{query}
			onQueryChange={(value) => {
				query = value;
				resetVisibleItems();
			}}
			placeholder={`Search ${activeListKey === MIX_STORAGE_KEYS.fridge ? "fridge" : "shopping list"}…`}
			label="Find ingredients"
			totalCount={activeItems.length}
			visibleCount={filteredItems.length}
			resultSummary={`${filteredItems.length} available · ${selectedInActiveList} selected`}
			itemLabel="ingredients"
			filterLabel="Filter and sort ingredients"
			filterValue={filter}
			{filterOptions}
			filtersActive={filtersOpen || filter !== "all" || sort !== "recent"}
			filterControlsId="mix-ingredient-filter-sheet-title"
			onFilterOpen={onOpenFilters}
		/>
		<div
			class="ingredient-chooser__list"
			bind:this={listElement}
			aria-label={activeListKey === MIX_STORAGE_KEYS.fridge
				? "Mix fridge ingredients"
				: "Mix shopping-list ingredients"}
			data-tutorial-target="mix-ingredient-options"
		>
			{#each visibleItems as food (food.fdcId)}
				<MixIngredientOption
					{food}
					selected={selectedFoodIds.includes(food.fdcId)}
					onSelect={() => onToggleFood(food.fdcId)}
				/>
			{/each}
			{#if visibleItems.length === 0}
				<p class="ingredient-chooser__empty">
					{activeItems.length
						? "No ingredients match these controls."
						: "This list is empty."}
				</p>
			{/if}
			<PaginatedListControls
				scrollContainer={listElement}
				{hasMoreItems}
				loadMoreLabel="Load more ingredients"
				contentVersion={`${activeListKey}:${query}:${filter}:${sort}:${visibleItems.length}`}
				containerElement="div"
				onLoadMore={revealMoreItems}
			/>
		</div>
	</div>
</MixPanelSection>

<style lang="scss">
	@use "./IngredientChooser.scss";
</style>
