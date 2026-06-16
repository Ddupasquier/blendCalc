<script lang="ts">
    import IngredientSearch from "$lib/components/ingredients/IngredientSearch.svelte";
    import BarcodeScanButton from "$lib/components/ingredients/BarcodeScanButton.svelte";
    import CustomIngredientForm from "$lib/components/ingredients/CustomIngredientForm.svelte";
    import NutritionPanel from "$lib/components/ingredients/NutritionPanel.svelte";
    import FoodListSection from "$lib/components/common/FoodListSection.svelte";
    import ListControls from "$lib/components/common/ListControls.svelte";
    import Pagination from "$lib/components/common/Pagination.svelte";
    import PillRow from "$lib/components/common/PillRow.svelte";
    import SortSelect from "$lib/components/common/SortSelect.svelte";
    import TextInputDialog from "$lib/components/common/TextInputDialog.svelte";
    import { LIST_PAGE_SIZES } from "../../defaults/listDefaults";
    import type { FdcFood } from "$lib/utils/food/types";
    import {
        clampPage,
        FOOD_LIST_SORT_OPTIONS,
        filterItemsByQuery,
        paginateItems,
        sortFoodListItems,
        type FoodListSort,
    } from "$lib/utils/list/listNavigation";
    import {
        cacheCustomFoodsLocally,
        readCustomFoods,
    } from "$lib/utils/food/customFoods";
    import {
        cacheSmoothieListLocally,
        readSmoothieList,
        removeFoodFromSmoothieList,
        renameFoodInSmoothieList,
        SMOOTHIE_LISTS_CHANGED_EVENT,
        type SmoothieListKey,
    } from "$lib/utils/storage/smoothieLists";
    import {
        reconcileCloudCustomFoods,
        reconcileCloudSmoothieList,
    } from "$lib/utils/storage/supabaseData";
    import { onMount, tick } from "svelte";
    import { MIX_STORAGE_KEYS } from "../../defaults/mixDefaults";

    let onHand = $state<FdcFood[]>([]);
    let shoppingList = $state<FdcFood[]>([]);
    let selectedFood = $state<FdcFood | null>(null);
    let closeManualSignal = $state(0);
    let scanSignal = $state(0);
    let barcodeLookupBusy = $state(false);
    let nutritionPreviewElement = $state<HTMLDivElement | null>(null);
    let listQuery = $state("");
    let sourceFilter = $state("all");
    let listSort = $state<FoodListSort>("recent");
    let onHandPage = $state(1);
    let shoppingPage = $state(1);
	let removingItem = $state<string | null>(null);
	let renamingItem = $state<{ key: SmoothieListKey; food: FdcFood } | null>(null);
	let renameBusy = $state(false);
	let renameError = $state("");
	let listActionError = $state("");

    const sourceFilterOptions = [
        { value: "all", label: "All sources" },
        { value: "custom", label: "Custom only" },
        { value: "fdc", label: "USDA only" },
    ];

    const filterFoods = (foods: FdcFood[]) => {
        const filteredFoods = filterItemsByQuery(
            foods.filter((food) => {
                if (sourceFilter === "custom") return food.customFood === true;
                if (sourceFilter === "fdc") return food.customFood !== true;
                return true;
            }),
            listQuery,
            (food) =>
                [food.description, food.brandOwner, food.foodCategory]
                    .filter(Boolean)
                    .join(" "),
        );

        return sortFoodListItems(
            filteredFoods,
            listSort,
            (food) => food.description,
            (food) => food.listAddedAt,
        );
    };

    const filteredOnHand = $derived.by(() => filterFoods(onHand));
    const filteredShoppingList = $derived.by(() => filterFoods(shoppingList));
    const pagedOnHand = $derived(
        paginateItems(
            filteredOnHand,
            onHandPage,
            LIST_PAGE_SIZES.ingredientPills,
        ),
    );
    const pagedShoppingList = $derived(
        paginateItems(
            filteredShoppingList,
            shoppingPage,
            LIST_PAGE_SIZES.ingredientPills,
        ),
    );

    const loadLists = async () => {
        const localFridge = readSmoothieList(MIX_STORAGE_KEYS.fridge);
        const localShoppingList = readSmoothieList(MIX_STORAGE_KEYS.shoppingList);

        onHand = localFridge;
        shoppingList = localShoppingList;

        const [nextFridge, nextShoppingList, nextCustomFoods] = await Promise.all([
            reconcileCloudSmoothieList(MIX_STORAGE_KEYS.fridge, localFridge),
            reconcileCloudSmoothieList(
                MIX_STORAGE_KEYS.shoppingList,
                localShoppingList,
            ),
            reconcileCloudCustomFoods(readCustomFoods()),
        ]);

        onHand = nextFridge;
        shoppingList = nextShoppingList;
        cacheSmoothieListLocally(MIX_STORAGE_KEYS.fridge, nextFridge);
        cacheSmoothieListLocally(MIX_STORAGE_KEYS.shoppingList, nextShoppingList);
        cacheCustomFoodsLocally(nextCustomFoods);
    };

    const closeManualEntry = () => {
        closeManualSignal += 1;
    };

    const startBarcodeScan = () => {
        closeManualEntry();
        scanSignal += 1;
    };

    const scrollToNutritionPreview = async () => {
        await tick();
        nutritionPreviewElement?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
        nutritionPreviewElement?.focus({ preventScroll: true });
    };

    const handleSelect = (food: FdcFood) => {
        selectedFood = food;
    };

    const handleCreate = async (food: FdcFood) => {
        selectedFood = food;
        await scrollToNutritionPreview();
    };

    const handleSearchSelect = async (food: FdcFood) => {
        closeManualEntry();
        selectedFood = food;
        await scrollToNutritionPreview();
    };

    const getItemActionKey = (key: SmoothieListKey, foodId: number) => {
		return `${key}:${foodId}`;
	};

    const removeFromList = async (key: SmoothieListKey, foodId: number) => {
		const actionKey = getItemActionKey(key, foodId);
		if (removingItem) return;

		removingItem = actionKey;
		listActionError = "";
		try {
			const result = await removeFoodFromSmoothieList(key, foodId);
			if (result === "error") {
				listActionError = "That ingredient could not be removed. Try again.";
				return;
			}
			if (selectedFood?.fdcId === foodId) selectedFood = null;
			await loadLists();
		} finally {
			removingItem = null;
		}
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
				await loadLists();
				return;
			}

			if (selectedFood?.fdcId === food.fdcId) {
				selectedFood = {
					...selectedFood,
					description: name.trim().replace(/\s+/g, " "),
				};
			}
			renamingItem = null;
			await loadLists();
		} finally {
			renameBusy = false;
		}
	};

	const getDisabledIndices = (key: SmoothieListKey, items: FdcFood[]) => {
		return items
			.map((item, index) =>
				removingItem === getItemActionKey(key, item.fdcId) ? index : -1,
			)
			.filter((index) => index >= 0);
	};

    const getActiveIndices = (items: FdcFood[]) => {
        if (!selectedFood) return [];
        const index = items.findIndex((item) => item.fdcId === selectedFood?.fdcId);
        return index === -1 ? [] : [index];
    };

    const updateListQuery = (value: string) => {
        listQuery = value;
        onHandPage = 1;
        shoppingPage = 1;
    };

    const updateSourceFilter = (value: string) => {
        sourceFilter = value;
        onHandPage = 1;
        shoppingPage = 1;
    };

    const updateListSort = (value: string) => {
        listSort = value as FoodListSort;
        onHandPage = 1;
        shoppingPage = 1;
    };

    $effect(() => {
        onHandPage = clampPage(
            onHandPage,
            filteredOnHand.length,
            LIST_PAGE_SIZES.ingredientPills,
        );
        shoppingPage = clampPage(
            shoppingPage,
            filteredShoppingList.length,
            LIST_PAGE_SIZES.ingredientPills,
        );
    });

    onMount(() => {
        loadLists();
        window.addEventListener("storage", loadLists);
        window.addEventListener(SMOOTHIE_LISTS_CHANGED_EVENT, loadLists);
        window.addEventListener("focus", loadLists);
        return () => {
            window.removeEventListener("storage", loadLists);
            window.removeEventListener(SMOOTHIE_LISTS_CHANGED_EVENT, loadLists);
            window.removeEventListener("focus", loadLists);
        };
    });

</script>

<div class="ingredients-page">
    <header class="ingredients-header">
        <div>
            <h2>Ingredients</h2>
            <p>Search foods, add them to your fridge, and track shopping needs.</p>
        </div>
    </header>

    <section class="ingredient-search-panel" aria-labelledby="ingredient-search-title">
        <div class="section-heading">
            <div>
                <h3 id="ingredient-search-title">Find Ingredients</h3>
                <p>Pick a result to add it to a list.</p>
            </div>
            <BarcodeScanButton
                scanning={barcodeLookupBusy}
                onclick={startBarcodeScan}
            />
        </div>
        <IngredientSearch
            onSelect={handleSearchSelect}
            onSearchFocus={closeManualEntry}
        />
        <CustomIngredientForm
            onCreate={handleCreate}
            closeManualSignal={closeManualSignal}
            {scanSignal}
            showScanButton={false}
            onLookupStateChange={(busy) => (barcodeLookupBusy = busy)}
        />
        {#if selectedFood}
            <div
                class="nutrition-preview"
                bind:this={nutritionPreviewElement}
                tabindex="-1"
            >
                <NutritionPanel food={selectedFood} />
            </div>
        {/if}
    </section>

    {#if onHand.length > 0 || shoppingList.length > 0}
        <div class="ingredient-list-controls">
            <ListControls
                id="ingredient-lists-search"
                query={listQuery}
                onQueryChange={updateListQuery}
                placeholder="Search your fridge and shopping list…"
                label="Find saved ingredients"
                totalCount={onHand.length + shoppingList.length}
                visibleCount={filteredOnHand.length + filteredShoppingList.length}
                itemLabel="ingredients"
                filterLabel="Source"
                filterValue={sourceFilter}
                filterOptions={sourceFilterOptions}
                onFilterChange={updateSourceFilter}
            />
            <SortSelect
                id="ingredient-lists-sort"
                value={listSort}
                options={FOOD_LIST_SORT_OPTIONS}
                onChange={updateListSort}
            />
        </div>
    {/if}

    <div class="ingredient-lists-grid">
		{#if listActionError}
			<p class="list-action-error" role="alert">{listActionError}</p>
		{/if}
        <FoodListSection
            title="On Hand"
            count={filteredOnHand.length}
            ariaLabel="On Hand ingredients"
            hasItems={pagedOnHand.length > 0}
            placeholder={onHand.length > 0
                ? "No On Hand ingredients match these filters."
                : "No ingredients on hand yet."}
        >
            {#if pagedOnHand.length > 0}
                <PillRow
                    pills={pagedOnHand.map((item) => item.description)}
                    activeIndices={getActiveIndices(pagedOnHand)}
                    customIndices={pagedOnHand
                        .map((food, i) => (food.customFood ? i : -1))
                        .filter((i) => i !== -1)}
                    disabledIndices={getDisabledIndices(
                        MIX_STORAGE_KEYS.fridge,
                        pagedOnHand,
                    )}
                    preserveOrder
                    onSelect={(idx) => handleSelect(pagedOnHand[idx])}
                    onRename={(idx) =>
                        openRenameDialog(MIX_STORAGE_KEYS.fridge, pagedOnHand[idx])}
                    onRemove={(idx) =>
                        removeFromList(
                            MIX_STORAGE_KEYS.fridge,
                            pagedOnHand[idx].fdcId,
                        )}
                />
                <Pagination
                    page={onHandPage}
                    pageSize={LIST_PAGE_SIZES.ingredientPills}
                    totalItems={filteredOnHand.length}
                    onPageChange={(page) => (onHandPage = page)}
                    label="On Hand ingredients"
                />
            {/if}
        </FoodListSection>

        <FoodListSection
            title="Shopping List"
            count={filteredShoppingList.length}
            ariaLabel="Shopping List ingredients"
            hasItems={pagedShoppingList.length > 0}
            placeholder={shoppingList.length > 0
                ? "No shopping-list ingredients match these filters."
                : "No items in shopping list yet."}
        >
            {#if pagedShoppingList.length > 0}
                <PillRow
                    pills={pagedShoppingList.map((item) => item.description)}
                    activeIndices={getActiveIndices(pagedShoppingList)}
                    customIndices={pagedShoppingList
                        .map((food, i) => (food.customFood ? i : -1))
                        .filter((i) => i !== -1)}
                    disabledIndices={getDisabledIndices(
                        MIX_STORAGE_KEYS.shoppingList,
                        pagedShoppingList,
                    )}
                    preserveOrder
                    onSelect={(idx) => handleSelect(pagedShoppingList[idx])}
                    onRename={(idx) =>
                        openRenameDialog(
                            MIX_STORAGE_KEYS.shoppingList,
                            pagedShoppingList[idx],
                        )}
                    onRemove={(idx) =>
                        removeFromList(
                            MIX_STORAGE_KEYS.shoppingList,
                            pagedShoppingList[idx].fdcId,
                        )}
                />
                <Pagination
                    page={shoppingPage}
                    pageSize={LIST_PAGE_SIZES.ingredientPills}
                    totalItems={filteredShoppingList.length}
                    onPageChange={(page) => (shoppingPage = page)}
                    label="Shopping List ingredients"
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
        confirmLabel={renameBusy ? "Saving…" : "Save name"}
        onConfirm={renameListItem}
        onValueChange={() => (renameError = "")}
        onCancel={closeRenameDialog}
    />
</div>

<style lang="scss">
    @use "../../styles/variables" as *;

    .ingredients-page {
        max-width: $app-max-width;
        margin: 0 auto;
        padding: $app-gap-sm 0;
        box-sizing: border-box;
    }

    .ingredients-header {
        margin-bottom: $app-gap-md;

        h2 {
            margin-bottom: 0.18rem;
            color: $app-primary;
            font-size: $app-font-size-xl;
            font-weight: 800;
        }

        p {
            color: $app-muted;
            font-size: $app-font-size-md;
        }
    }

    .ingredient-search-panel {
        display: grid;
        gap: $app-gap-sm;
        padding: $app-gap-md;
        margin-bottom: $app-gap-md;
        background: $app-section-bg;
        border: $app-border;
        border-radius: $app-card-radius;
    }

    .section-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: $app-gap-sm;

        h3 {
            margin-bottom: 0.1rem;
            color: $app-primary;
            font-size: $app-font-size-lg;
            font-weight: 800;
        }

        p {
            color: $app-muted;
            font-size: $app-font-size-sm;
        }
    }

    .nutrition-preview {
        min-width: 0;

        &:focus {
            outline: none;
        }

        &:focus-visible {
            outline: $app-focus-outline;
            outline-offset: $app-gap-xs;
        }
    }

    .ingredient-lists-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: $app-gap-md;
    }

	.list-action-error {
		grid-column: 1 / -1;
		padding: $app-gap-sm;
		color: $app-warning-strong;
		background: $app-warning-bg;
		border: $app-warning-border;
		border-radius: $app-radius;
		font-size: $app-font-size-sm;
		font-weight: 800;
	}

    .ingredient-list-controls {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(10rem, auto);
        align-items: end;
        gap: $app-gap-sm;
        margin-bottom: $app-gap-md;
    }

    @media (max-width: $app-breakpoint-lg) {
        .ingredients-page {
            padding-top: $app-gap-sm;
        }

        .ingredient-lists-grid {
            grid-template-columns: 1fr;
        }

        .ingredient-list-controls {
            grid-template-columns: 1fr;
        }

        .section-heading {
            align-items: start;
        }
    }
</style>
