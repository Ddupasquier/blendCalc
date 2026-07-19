<script lang="ts">
	import PillRow from "$lib/components/common/display/PillRow.svelte";
	import FoodListSection from "$lib/components/common/lists/FoodListSection.svelte";
	import ListControls from "$lib/components/common/lists/ListControls.svelte";
	import Pagination from "$lib/components/common/lists/Pagination.svelte";
	import SortSelect from "$lib/components/common/lists/SortSelect.svelte";
	import TextInputDialog from "$lib/components/common/dialogs/TextInputDialog.svelte";
	import { MIX_STORAGE_KEYS } from "../../../../defaults/mixDefaults";
	import type { FdcFood } from "$lib/utils/food/types";
	import { getFoodPreferenceContext } from "$lib/utils/profile/foodPreferenceContext.svelte";
	import { getFoodWarningLabel } from "$lib/utils/profile/foodPreferenceWarnings";
	import {
		clampPage,
		FOOD_LIST_SORT_OPTIONS,
		filterItemsByQuery,
		paginateItems,
		sortFoodListItems,
		type FoodListSort,
	} from "$lib/utils/list/listNavigation";
	import {
		renameFoodInSmoothieList,
		type SmoothieListKey,
	} from "$lib/utils/storage/client/smoothieLists";
	import { LIST_PAGE_SIZES } from "../../../../defaults/listDefaults";

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
	let renamingItem = $state<{ key: SmoothieListKey; food: FdcFood } | null>(null);
	let renameBusy = $state(false);
	let renameError = $state("");
	const foodPreferenceContext = getFoodPreferenceContext();

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
	const getFoodLabel = (food: FdcFood) => {
		const warningLabel = getFoodWarningLabel(food, foodPreferenceContext.current);
		return warningLabel ? `${warningLabel} ${food.description}` : food.description;
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

	const openRenameDialog = (key: SmoothieListKey, food: FdcFood) => {
		renamingItem = { key, food };
		renameError = "";
	};

	const closeRenameDialog = () => {
		if (renameBusy) return;
		renamingItem = null;
		renameError = "";
	};

	const renameListItem = async (name: string) => {
		if (!renamingItem || renameBusy) return;

		renameBusy = true;
		renameError = "";
		const { key, food } = renamingItem;

		try {
			const result = await renameFoodInSmoothieList(key, food.fdcId, name);
			if (result === "invalid") {
				renameError = "Enter a name for this ingredient.";
				return;
			}
			if (result === "duplicate") {
				renameError = "Another ingredient in this list already uses that name.";
				return;
			}
			if (result === "error") {
				renameError = "That ingredient could not be renamed. Try again.";
				return;
			}
			if (result === "missing") {
				renameError = "That ingredient is no longer in this list.";
				return;
			}

			renamingItem = null;
		} finally {
			renameBusy = false;
		}
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
		<FoodListSection
			title="Fridge"
			count={filteredFridgeItems.length}
			ariaLabel="Mix fridge ingredients"
			hasItems={pagedFridgeItems.length > 0}
			placeholder={fridgeItems.length > 0
				? "No fridge ingredients match these filters."
				: "No fridge items yet."}
		>
			{#if pagedFridgeItems.length > 0}
				<PillRow
					pills={pagedFridgeItems.map((food) => getFoodLabel(food))}
					onRemove={(index) => onToggleFood(pagedFridgeItems[index].fdcId)}
					onRename={(index) =>
						openRenameDialog(MIX_STORAGE_KEYS.fridge, pagedFridgeItems[index])}
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
			{/if}
		</FoodListSection>

		<FoodListSection
			title="Shopping List"
			count={filteredShoppingItems.length}
			ariaLabel="Mix shopping-list ingredients"
			hasItems={pagedShoppingItems.length > 0}
			placeholder={shoppingItems.length > 0
				? "No shopping-list ingredients match these filters."
				: "No shopping list items yet."}
		>
			{#if pagedShoppingItems.length > 0}
				<PillRow
					pills={pagedShoppingItems.map((food) => getFoodLabel(food))}
					onRemove={(index) => onToggleFood(pagedShoppingItems[index].fdcId)}
					onRename={(index) =>
						openRenameDialog(
							MIX_STORAGE_KEYS.shoppingList,
							pagedShoppingItems[index],
						)}
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
			{/if}
		</FoodListSection>
	</div>

	<TextInputDialog
		open={renamingItem !== null}
		title="Rename ingredient"
		description="This only changes the name in your own fridge or shopping list."
		label="Ingredient name"
		initialValue={renamingItem?.food.description ?? ""}
		error={renameError}
		busy={renameBusy}
		confirmLabel="Save name"
		onConfirm={renameListItem}
		onValueChange={() => (renameError = "")}
		onCancel={closeRenameDialog}
	/>
</section>

<style lang="scss">
	@use "../../../../styles/variables" as *;

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
