<script lang="ts">
    import Sliders from "$lib/assets/icons/Sliders.svelte";
    import IngredientSearch from "$lib/components/ingredients/IngredientSearch.svelte";
    import BarcodeScanButton from "$lib/components/ingredients/BarcodeScanButton.svelte";
    import CustomIngredientForm from "$lib/components/ingredients/CustomIngredientForm.svelte";
    import IngredientActionSheet from "$lib/components/ingredients/IngredientActionSheet.svelte";
    import IngredientBulkActions from "$lib/components/ingredients/IngredientBulkActions.svelte";
    import IngredientEmptyState from "$lib/components/ingredients/IngredientEmptyState.svelte";
    import IngredientListTabs from "$lib/components/ingredients/IngredientListTabs.svelte";
    import NutritionPanel from "$lib/components/ingredients/NutritionPanel.svelte";
    import SavedIngredientCard from "$lib/components/ingredients/SavedIngredientCard.svelte";
    import ListControls from "$lib/components/common/ListControls.svelte";
    import SortSelect from "$lib/components/common/SortSelect.svelte";
    import TextInputDialog from "$lib/components/common/TextInputDialog.svelte";
    import {
        LIST_PAGE_SIZES,
        LIST_REVEAL_BUFFER_PX,
    } from "../../defaults/listDefaults";
    import type { FdcFood } from "$lib/utils/food/types";
    import {
        areFoodIdsEqual,
        getFoodCalories,
        getFoodDisplayCategory,
        getFoodIcon,
        getFoodSourceLabel,
        getIngredientActionKey,
        getIngredientListLabel,
        getIngredientMoveLabel,
        getOppositeIngredientListKey,
        getPrimaryFoodWarning,
        INGREDIENT_SOURCE_FILTER_OPTIONS,
        type IngredientActionItem,
    } from "$lib/utils/ingredients/ingredientListUi";
    import {
        FOOD_LIST_SORT_OPTIONS,
        filterItemsByQuery,
        sortFoodListItems,
        type FoodListSort,
    } from "$lib/utils/list/listNavigation";
    import {
        cacheCustomFoodsLocally,
        readCustomFoods,
    } from "$lib/utils/food/customFoods";
    import {
        addFoodToSmoothieList,
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
    import { getFoodPreferenceContext } from "$lib/utils/profile/foodPreferenceContext.svelte";
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
    let activeList = $state<SmoothieListKey>(MIX_STORAGE_KEYS.fridge);
    let filtersOpen = $state(false);
    let onHandVisibleCount = $state<number>(LIST_PAGE_SIZES.ingredientPills);
    let shoppingVisibleCount = $state<number>(LIST_PAGE_SIZES.ingredientPills);
    let selectedListItemIds = $state<Record<SmoothieListKey, number[]>>({
        [MIX_STORAGE_KEYS.fridge]: [],
        [MIX_STORAGE_KEYS.shoppingList]: [],
    });
    let actionSheetItem = $state<IngredientActionItem | null>(null);
    let movingItem = $state<string | null>(null);
	let removingItem = $state<string | null>(null);
	let renamingItem = $state<{ key: SmoothieListKey; food: FdcFood } | null>(null);
	let renameBusy = $state(false);
	let renameError = $state("");
	let listActionError = $state("");
    const foodPreferenceContext = getFoodPreferenceContext();


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
    const activeFilteredList = $derived.by(() =>
        activeList === MIX_STORAGE_KEYS.fridge
            ? filteredOnHand
            : filteredShoppingList,
    );
    const activeVisibleCount = $derived.by(() =>
        activeList === MIX_STORAGE_KEYS.fridge
            ? onHandVisibleCount
            : shoppingVisibleCount,
    );
    const activeVisibleList = $derived.by(() =>
        activeFilteredList.slice(0, activeVisibleCount),
    );
    const activeRawList = $derived.by(() =>
        activeList === MIX_STORAGE_KEYS.fridge ? onHand : shoppingList,
    );
    const selectedActiveItemIds = $derived.by(
        () => selectedListItemIds[activeList] ?? [],
    );
    const canRevealMoreActiveItems = $derived(
        activeVisibleList.length < activeFilteredList.length,
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

    const openManualEntry = async () => {
        await tick();
        const manualDetails = document.querySelector<HTMLDetailsElement>(
            ".custom-ingredient__manual",
        );
        if (!manualDetails) return;
        manualDetails.open = true;
        manualDetails.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
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

    const removeFromList = async (key: SmoothieListKey, foodId: number) => {
		const actionKey = getIngredientActionKey(key, foodId);
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
			setSelectedIds(
				key,
				(selectedListItemIds[key] ?? []).filter((id) => id !== foodId),
			);
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

    const isBulkSelected = (key: SmoothieListKey, foodId: number) =>
        (selectedListItemIds[key] ?? []).includes(foodId);

    const setSelectedIds = (key: SmoothieListKey, foodIds: number[]) => {
        selectedListItemIds = {
            ...selectedListItemIds,
            [key]: [...new Set(foodIds)],
        };
    };

    const toggleBulkSelection = (key: SmoothieListKey, foodId: number) => {
        const currentIds = selectedListItemIds[key] ?? [];
        setSelectedIds(
            key,
            currentIds.includes(foodId)
                ? currentIds.filter((id) => id !== foodId)
                : [...currentIds, foodId],
        );
    };

    const selectAllActiveItems = () => {
        setSelectedIds(
            activeList,
            activeFilteredList.map((food) => food.fdcId),
        );
    };

    const clearActiveSelection = () => {
        setSelectedIds(activeList, []);
    };

    const moveFoodBetweenLists = async (
        sourceKey: SmoothieListKey,
        food: FdcFood,
    ) => {
        const targetKey = getOppositeIngredientListKey(sourceKey);
        const actionKey = getIngredientActionKey(sourceKey, food.fdcId);
        movingItem = actionKey;
        listActionError = "";

        try {
            const addResult = await addFoodToSmoothieList(targetKey, food);
            if (addResult === "error") {
                listActionError = `${food.description} could not be moved. Try again.`;
                return;
            }

            const removeResult = await removeFoodFromSmoothieList(
                sourceKey,
                food.fdcId,
            );
            if (removeResult === "error") {
                listActionError = `${food.description} was added to ${getIngredientListLabel(targetKey)}, but could not be removed from ${getIngredientListLabel(sourceKey)}.`;
                return;
            }

            if (selectedFood?.fdcId === food.fdcId) selectedFood = null;
            setSelectedIds(
                sourceKey,
                (selectedListItemIds[sourceKey] ?? []).filter(
                    (id) => id !== food.fdcId,
                ),
            );
            await loadLists();
        } finally {
            movingItem = null;
        }
    };

    const moveSelectedItems = async () => {
        const selectedIds = selectedListItemIds[activeList] ?? [];
        if (selectedIds.length === 0 || movingItem) return;

        const selectedFoods = activeRawList.filter((food) =>
            selectedIds.includes(food.fdcId),
        );

        for (const food of selectedFoods) {
            await moveFoodBetweenLists(activeList, food);
            if (listActionError) return;
        }
        clearActiveSelection();
    };

    const openActionSheet = (key: SmoothieListKey, food: FdcFood) => {
        actionSheetItem = { key, food };
    };

    const closeActionSheet = () => {
        if (movingItem || removingItem) return;
        actionSheetItem = null;
    };

    const renameFromActionSheet = () => {
        if (!actionSheetItem) return;
        openRenameDialog(actionSheetItem.key, actionSheetItem.food);
        actionSheetItem = null;
    };

    const moveFromActionSheet = async () => {
        if (!actionSheetItem) return;
        const currentItem = actionSheetItem;
        actionSheetItem = null;
        await moveFoodBetweenLists(currentItem.key, currentItem.food);
    };

    const removeFromActionSheet = async () => {
        if (!actionSheetItem) return;
        const currentItem = actionSheetItem;
        actionSheetItem = null;
        await removeFromList(currentItem.key, currentItem.food.fdcId);
    };

    const selectList = (key: SmoothieListKey) => {
        activeList = key;
    };

    const resetVisibleCounts = () => {
        onHandVisibleCount = LIST_PAGE_SIZES.ingredientPills;
        shoppingVisibleCount = LIST_PAGE_SIZES.ingredientPills;
    };

    const revealMoreActiveItems = () => {
        if (!canRevealMoreActiveItems) return;

        if (activeList === MIX_STORAGE_KEYS.fridge) {
            onHandVisibleCount = Math.min(
                filteredOnHand.length,
                onHandVisibleCount + LIST_PAGE_SIZES.ingredientPills,
            );
            return;
        }

        shoppingVisibleCount = Math.min(
            filteredShoppingList.length,
            shoppingVisibleCount + LIST_PAGE_SIZES.ingredientPills,
        );
    };

    const handleActiveListScroll = (event: Event) => {
        const listElement = event.currentTarget;
        if (!(listElement instanceof HTMLElement)) return;

        const distanceFromBottom =
            listElement.scrollHeight -
            listElement.scrollTop -
            listElement.clientHeight;

        if (distanceFromBottom <= LIST_REVEAL_BUFFER_PX) {
            revealMoreActiveItems();
        }
    };

    const revealMoreOnIntersect = (node: HTMLElement) => {
        if (typeof IntersectionObserver === "undefined") return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) revealMoreActiveItems();
            },
            { rootMargin: "12rem 0px" },
        );

        observer.observe(node);

        return {
            destroy() {
                observer.disconnect();
            },
        };
    };

    const updateListQuery = (value: string) => {
        listQuery = value;
        resetVisibleCounts();
    };

    const updateSourceFilter = (value: string) => {
        sourceFilter = value;
        resetVisibleCounts();
    };

    const updateListSort = (value: string) => {
        listSort = value as FoodListSort;
        resetVisibleCounts();
    };

    $effect(() => {
        onHandVisibleCount = Math.min(
            Math.max(onHandVisibleCount, LIST_PAGE_SIZES.ingredientPills),
            Math.max(filteredOnHand.length, LIST_PAGE_SIZES.ingredientPills),
        );
        shoppingVisibleCount = Math.min(
            Math.max(shoppingVisibleCount, LIST_PAGE_SIZES.ingredientPills),
            Math.max(filteredShoppingList.length, LIST_PAGE_SIZES.ingredientPills),
        );
        const nextFridgeIds = selectedListItemIds[MIX_STORAGE_KEYS.fridge].filter(
            (id) => onHand.some((food) => food.fdcId === id),
        );
        const nextShoppingIds = selectedListItemIds[
            MIX_STORAGE_KEYS.shoppingList
        ].filter((id) => shoppingList.some((food) => food.fdcId === id));

        if (
            !areFoodIdsEqual(
                selectedListItemIds[MIX_STORAGE_KEYS.fridge],
                nextFridgeIds,
            ) ||
            !areFoodIdsEqual(
                selectedListItemIds[MIX_STORAGE_KEYS.shoppingList],
                nextShoppingIds,
            )
        ) {
            selectedListItemIds = {
                [MIX_STORAGE_KEYS.fridge]: nextFridgeIds,
                [MIX_STORAGE_KEYS.shoppingList]: nextShoppingIds,
            };
        }
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
        <h1>Ingredients</h1>
        <p>Search foods, add them to your fridge, and track shopping needs.</p>
    </header>

    <section class="ingredient-search-panel" aria-labelledby="ingredient-search-title">
        <h2 id="ingredient-search-title" class="sr-only">Find Ingredients</h2>
        <div class="search-toolbar">
            <div class="search-toolbar__input">
                <IngredientSearch
                    onSelect={handleSearchSelect}
                    onSearchFocus={closeManualEntry}
                />
            </div>
            <BarcodeScanButton
                scanning={barcodeLookupBusy}
                compact
                onclick={startBarcodeScan}
            />
            <button
                class="filter-button"
                class:filter-button--active={filtersOpen}
                type="button"
                aria-expanded={filtersOpen}
                aria-controls="ingredient-list-filters"
                onclick={() => (filtersOpen = !filtersOpen)}
            >
                <span class="sr-only">Filter saved ingredients</span>
                <Sliders class="filter-button__icon" />
            </button>
        </div>

        <CustomIngredientForm
            onCreate={handleCreate}
            closeManualSignal={closeManualSignal}
            {scanSignal}
            showScanButton={false}
            onLookupStateChange={(busy) => (barcodeLookupBusy = busy)}
        />

        {#if filtersOpen && (onHand.length > 0 || shoppingList.length > 0)}
            <div id="ingredient-list-filters" class="ingredient-list-controls">
                <ListControls
                    id="ingredient-lists-search"
                    query={listQuery}
                    onQueryChange={updateListQuery}
                    placeholder="Find a saved ingredient…"
                    label="Find saved ingredients"
                    totalCount={onHand.length + shoppingList.length}
                    visibleCount={filteredOnHand.length + filteredShoppingList.length}
                    itemLabel="ingredients"
                    filterLabel="Source"
                    filterValue={sourceFilter}
                    filterOptions={INGREDIENT_SOURCE_FILTER_OPTIONS}
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

        {#if selectedFood}
            <div
                class="nutrition-preview"
                bind:this={nutritionPreviewElement}
                tabindex="-1"
            >
                <button
                    class="nutrition-preview__back"
                    type="button"
                    onclick={() => (selectedFood = null)}
                >
                    ← Back to ingredients
                </button>
                <NutritionPanel food={selectedFood} />
            </div>
        {/if}
    </section>

    <section class="saved-ingredients" aria-labelledby="saved-ingredients-title">
        <h2 id="saved-ingredients-title" class="sr-only">Saved ingredients</h2>
        <IngredientListTabs
            {activeList}
            fridgeCount={filteredOnHand.length}
            shoppingListCount={filteredShoppingList.length}
            onSelect={selectList}
        />

        {#if listActionError}
            <p class="list-action-error" role="alert">{listActionError}</p>
        {/if}

        {#if activeVisibleList.length > 0}
            <IngredientBulkActions
                selectedCount={selectedActiveItemIds.length}
                moveTargetLabel={getIngredientListLabel(getOppositeIngredientListKey(activeList))}
                moving={movingItem !== null}
                onSelectAll={selectAllActiveItems}
                onClear={clearActiveSelection}
                onMove={moveSelectedItems}
            />
        {/if}

        <div class="saved-ingredients__body">
            {#if activeVisibleList.length > 0}
                <ul
                    class="ingredient-card-list"
                    aria-label={`${getIngredientListLabel(activeList)} ingredients`}
                    onscroll={handleActiveListScroll}
                >
                    {#each activeVisibleList as food (food.fdcId)}
                        {@const kcal = getFoodCalories(food)}
                        {@const warning = getPrimaryFoodWarning(food, foodPreferenceContext.current)}
                        {@const isChecked = isBulkSelected(activeList, food.fdcId)}
                        <li>
                            <SavedIngredientCard
                                {food}
                                active={selectedFood?.fdcId === food.fdcId}
                                checked={isChecked}
                                removing={removingItem ===
                                    getIngredientActionKey(activeList, food.fdcId)}
                                {kcal}
                                icon={getFoodIcon(food)}
                                category={getFoodDisplayCategory(food)}
                                {warning}
                                sourceLabel={getFoodSourceLabel(food)}
                                onToggle={() => toggleBulkSelection(activeList, food.fdcId)}
                                onPreview={() => handleSelect(food)}
                                onActions={() => openActionSheet(activeList, food)}
                                onRemove={() => removeFromList(activeList, food.fdcId)}
                            />
                        </li>
                    {/each}
                    {#if canRevealMoreActiveItems}
                        <li
                            class="ingredient-card-list__sentinel"
                            aria-hidden="true"
                            use:revealMoreOnIntersect
                        ></li>
                        <li class="ingredient-card-list__load-more">
                            <button type="button" onclick={revealMoreActiveItems}>
                                Load more {getIngredientListLabel(activeList).toLowerCase()} items
                            </button>
                        </li>
                    {/if}
                </ul>
            {:else}
                <IngredientEmptyState
                    {activeList}
                    hasItems={activeRawList.length > 0}
                />
            {/if}
        </div>
    </section>

    <IngredientActionSheet
        open={actionSheetItem !== null}
        title={actionSheetItem?.food.description ?? ""}
        moveLabel={actionSheetItem ? getIngredientMoveLabel(actionSheetItem.key) : ""}
        removeLabel={actionSheetItem
            ? `Remove from ${getIngredientListLabel(actionSheetItem.key)}`
            : ""}
        moving={movingItem !== null}
        removing={removingItem !== null}
        onClose={closeActionSheet}
        onRename={renameFromActionSheet}
        onMove={moveFromActionSheet}
        onRemove={removeFromActionSheet}
    />

    <button
        class="add-ingredient-fab"
        type="button"
        aria-label="Add ingredient manually"
        onclick={openManualEntry}
    >
        +
    </button>

    <TextInputDialog
        open={renamingItem !== null}
        title="Rename ingredient"
        description="This only changes the display label in your lists. Original data is preserved."
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

    :global(.app-main--authed:has(.ingredients-page)) {
        min-height: 0;
        padding-bottom: 0;
        overflow: hidden;
    }

    .ingredients-page {
        display: grid;
        grid-template-rows: auto auto minmax(0, 1fr);
        row-gap: $app-vertical-stack-gap;
        width: 100%;
        max-width: $app-mobile-shell-width;
        height: calc(
            100dvh - $app-shell-header-height - $app-shell-nav-height -
                env(safe-area-inset-bottom)
        );
        min-height: 0;
        margin: 0 auto;
        padding: $app-shell-padding-y $app-shell-padding-x $app-vertical-stack-gap;
        box-sizing: border-box;
        overflow: hidden;
        background: $color-figma-canvas;
    }

    .ingredients-header {
        margin-bottom: 0;

        h1 {
            margin: 0 0 0.35rem;
            color: $color-figma-ink;
            font-family: $app-font-family-display;
            font-size: clamp(1.75rem, 7vw, 2.1rem);
            font-weight: $app-font-weight-heavy;
            letter-spacing: -0.05em;
            line-height: 0.98;
        }

        p {
            max-width: 24rem;
            color: $color-figma-muted;
            font-size: $app-font-size-md;
            font-weight: $app-font-weight-medium;
            line-height: 1.35;
        }
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
        grid-template-columns: minmax(0, 1fr) $app-rebuild-control-height $app-rebuild-control-height;
        align-items: stretch;
        gap: $app-horizontal-control-gap;
    }

    .search-toolbar__input {
        min-width: 0;
    }

    .search-toolbar :global(.barcode-scan-button--compact) {
        align-self: stretch;
        width: $app-rebuild-control-height;
        height: $app-rebuild-control-height;
        min-height: $app-rebuild-control-height;
    }

    .filter-button {
        display: inline-grid;
        place-items: center;
        align-self: stretch;
        width: $app-rebuild-control-height;
        height: $app-rebuild-control-height;
        color: $color-figma-muted;
        background: $color-figma-control-surface;
        border: 0;
        border-radius: $app-rebuild-radius;
        transition:
            color 160ms ease,
            background-color 160ms ease,
            transform 160ms ease;

        :global(.filter-button__icon) {
            width: $app-rebuild-control-icon-size;
            height: $app-rebuild-control-icon-size;
        }

        &:hover,
        &--active {
            color: $color-figma-green;
            background: $color-figma-green-soft;
        }

        &:active {
            transform: scale(0.97);
        }

        &:focus-visible {
            outline: $app-focus-outline;
            outline-offset: $app-gap-xs;
        }
    }

    .nutrition-preview {
        min-width: 0;
        padding-top: 0.35rem;

        &:focus {
            outline: none;
        }

        &:focus-visible {
            outline: $app-focus-outline;
            outline-offset: $app-gap-xs;
        }
    }

    .nutrition-preview__back {
        width: fit-content;
        margin-bottom: $app-gap-sm;
        padding: 0.55rem 0.8rem;
        color: $color-figma-ink;
        background: $color-figma-card;
        border: 0;
        border-radius: $app-radius-pill;
        font-family: $app-button-font-family;
        font-size: $app-font-size-sm;
        font-weight: $app-button-font-weight;
        line-height: $app-button-line-height;
    }

    .saved-ingredients {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-rows: auto auto auto minmax(0, 1fr);
        gap: $app-vertical-stack-gap;
        min-height: 0;
        padding-top: 0;
    }

    .saved-ingredients__body {
        grid-row: -2 / -1;
        min-height: 0;
        overflow: hidden;
    }

    .ingredient-card-list {
        display: grid;
        align-content: start;
        gap: $app-vertical-stack-gap;
        height: 100%;
        min-height: 0;
        margin: 0;
        padding: 0 0 $app-gap-sm;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-gutter: stable;
        list-style: none;
    }

    .ingredient-card-list__sentinel {
        min-height: 1px;
    }

    .ingredient-card-list__load-more {
        display: grid;
        place-items: center;
        padding: $app-gap-xs 0 $app-gap-sm;

        button {
            min-height: $app-rebuild-control-height-sm;
            padding: 0.45rem 0.9rem;
            color: $color-figma-green;
            background: $color-figma-green-soft;
            border: 0;
            border-radius: $app-rebuild-radius-pill;
            font-family: $app-button-font-family;
            font-size: $app-font-size-sm;
            font-weight: $app-button-font-weight;
            line-height: $app-button-line-height;
        }
    }

	.list-action-error {
		padding: $app-gap-sm;
		color: $app-warning-strong;
		background: $app-warning-bg;
		border: $app-warning-border;
		border-radius: $app-radius;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-bold;
	}

    .ingredient-list-controls {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(10rem, auto);
        align-items: end;
        gap: $app-gap-sm;
        padding: $app-gap-sm;
        background: $color-figma-card;
        border: 1px solid $color-figma-border;
        border-radius: $app-rebuild-radius;
    }

    .add-ingredient-fab {
        position: fixed;
        right: max($app-shell-padding-x, calc((100vw - $app-mobile-shell-width) / 2 + $app-shell-padding-x));
        bottom: calc($app-shell-nav-height + $app-gap-md);
        z-index: 12;
        display: inline-grid;
        place-items: center;
        width: $app-rebuild-fab-size;
        height: $app-rebuild-fab-size;
        color: $color-figma-card;
        background: $color-figma-green;
        border: 0;
        border-radius: $app-rebuild-radius;
        font-size: 2rem;
        font-weight: $app-font-weight-medium;
        line-height: 1;
    }

    @media (max-width: $app-breakpoint-lg) {
        .ingredient-list-controls {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: $app-breakpoint-xs) {
        .ingredients-page {
            padding-inline: $app-gap-sm;
        }

        .search-toolbar {
            gap: $app-horizontal-control-gap;
        }

        .filter-button {
            width: $app-rebuild-control-height;
            height: $app-rebuild-control-height;
        }
    }
</style>
