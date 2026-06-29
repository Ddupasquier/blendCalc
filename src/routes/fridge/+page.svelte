<script lang="ts">
    import Sliders from "$lib/assets/icons/Sliders.svelte";
    import RightSheet from "$lib/components/common/RightSheet.svelte";
    import ViewBody from "$lib/components/common/view/ViewBody.svelte";
    import ViewFrame from "$lib/components/common/view/ViewFrame.svelte";
    import ViewHeader from "$lib/components/common/view/ViewHeader.svelte";
    import ViewTop from "$lib/components/common/view/ViewTop.svelte";
    import BarcodeScanButton from "$lib/components/ingredients/barcode/BarcodeScanButton.svelte";
    import IngredientActionSheet from "$lib/components/ingredients/sheets/IngredientActionSheet.svelte";
    import IngredientBulkActions from "$lib/components/ingredients/list/IngredientBulkActions.svelte";
    import IngredientEmptyState from "$lib/components/ingredients/list/IngredientEmptyState.svelte";
    import IngredientFilterSheet from "$lib/components/ingredients/sheets/IngredientFilterSheet.svelte";
    import IngredientListTabs from "$lib/components/ingredients/list/IngredientListTabs.svelte";
    import IngredientSearchTrigger from "$lib/components/ingredients/search/IngredientSearchTrigger.svelte";
    import IngredientSearchView from "$lib/components/ingredients/search/IngredientSearchView.svelte";
    import ManualEntryLauncher from "$lib/components/ingredients/manual-entry/ManualEntryLauncher.svelte";
    import ManualEntrySheet from "$lib/components/ingredients/sheets/ManualEntrySheet.svelte";
    import NutritionDetailView from "$lib/components/ingredients/nutrition/NutritionDetailView.svelte";
    import SavedIngredientCard from "$lib/components/ingredients/list/SavedIngredientCard.svelte";
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
        readSmoothieList,
        removeFoodFromSmoothieList,
        renameFoodInSmoothieList,
        SMOOTHIE_LISTS_CHANGED_EVENT,
        type SmoothieListKey,
    } from "$lib/utils/storage/smoothieLists";
    import {
        reconcileCloudCustomFoods,
        readCloudSmoothieListPage,
    } from "$lib/utils/storage/supabaseData";
    import { onMount, tick } from "svelte";
    import { getFoodPreferenceContext } from "$lib/utils/profile/foodPreferenceContext.svelte";
    import { MIX_STORAGE_KEYS } from "../../defaults/mixDefaults";

    let onHand = $state<FdcFood[]>([]);
    let shoppingList = $state<FdcFood[]>([]);
    let selectedFood = $state<FdcFood | null>(null);
    let scanSignal = $state(0);
    let barcodeLookupBusy = $state(false);
    let listQuery = $state("");
    let sourceFilter = $state("all");
    let listSort = $state<FoodListSort>("recent");
    let activeList = $state<SmoothieListKey>(MIX_STORAGE_KEYS.fridge);
    let activeSheet = $state<"manual-entry" | "filters" | null>(null);
    let searchViewOpen = $state(false);
    let onHandVisibleCount = $state<number>(LIST_PAGE_SIZES.ingredientPills);
    let shoppingVisibleCount = $state<number>(LIST_PAGE_SIZES.ingredientPills);
    let onHandTotalCount = $state(0);
    let shoppingListTotalCount = $state(0);
    let listLoading = $state(true);
    let listLoadingError = $state("");
    let listLoadRequestId = 0;
    let loadingMoreList = $state<SmoothieListKey | null>(null);
    let ingredientListElement = $state<HTMLUListElement | null>(null);
    let ingredientListSentinel = $state<HTMLLIElement | null>(null);
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

    const filteredOnHand = $derived(onHand);
    const filteredShoppingList = $derived(shoppingList);
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
    const activeTotalCount = $derived.by(() =>
        activeList === MIX_STORAGE_KEYS.fridge
            ? onHandTotalCount
            : shoppingListTotalCount,
    );
    const selectedActiveItemIds = $derived.by(
        () => selectedListItemIds[activeList] ?? [],
    );
    const canRevealMoreActiveItems = $derived(
        activeVisibleList.length < activeFilteredList.length ||
            activeRawList.length < activeTotalCount,
    );

    const readLocalListPage = (
        key: SmoothieListKey,
        offset: number,
        limit: number,
    ) => {
        const foods = filterFoods(readSmoothieList(key));
        return {
            foods: foods.slice(offset, offset + limit),
            totalCount: foods.length,
        };
    };

    const setListPage = (
        key: SmoothieListKey,
        foods: FdcFood[],
        totalCount: number,
        reset: boolean,
    ) => {
        if (key === MIX_STORAGE_KEYS.fridge) {
            onHand = reset ? foods : [...onHand, ...foods];
            onHandTotalCount = totalCount;
            onHandVisibleCount = reset
                ? LIST_PAGE_SIZES.ingredientPills
                : Math.max(onHandVisibleCount, onHand.length);
            return;
        }

        shoppingList = reset ? foods : [...shoppingList, ...foods];
        shoppingListTotalCount = totalCount;
        shoppingVisibleCount = reset
            ? LIST_PAGE_SIZES.ingredientPills
            : Math.max(shoppingVisibleCount, shoppingList.length);
    };

    const loadListPage = async (
        key: SmoothieListKey,
        reset = false,
        requestId = listLoadRequestId,
    ) => {
        const currentOffset = reset
            ? 0
            : key === MIX_STORAGE_KEYS.fridge
                ? onHand.length
                : shoppingList.length;
        const pageSize = LIST_PAGE_SIZES.ingredientPills;
        const cloudPage = await readCloudSmoothieListPage(key, {
            limit: pageSize,
            offset: currentOffset,
            query: listQuery,
            sort: listSort,
            sourceFilter,
        });
        const page =
            cloudPage ?? readLocalListPage(key, currentOffset, pageSize);

        if (requestId !== listLoadRequestId) return;
        setListPage(key, page.foods, page.totalCount, reset);
    };

    const loadLists = async () => {
        const requestId = ++listLoadRequestId;
        listLoading = true;
        listLoadingError = "";
        resetVisibleCounts();
        try {
            const [nextCustomFoods] = await Promise.all([
                reconcileCloudCustomFoods(readCustomFoods()),
                loadListPage(MIX_STORAGE_KEYS.fridge, true, requestId),
                loadListPage(MIX_STORAGE_KEYS.shoppingList, true, requestId),
            ]);

            if (requestId !== listLoadRequestId) return;
            cacheCustomFoodsLocally(nextCustomFoods);
        } catch {
            if (requestId === listLoadRequestId) {
                listLoadingError =
                    "Saved ingredients could not be loaded. Try again.";
            }
        } finally {
            if (requestId === listLoadRequestId) {
                listLoading = false;
            }
        }
    };

    const closeIngredientSheet = () => {
        activeSheet = null;
    };

    const startBarcodeScan = () => {
        searchViewOpen = false;
        activeSheet = "manual-entry";
        scanSignal += 1;
    };

    const openManualEntry = () => {
        activeSheet = "manual-entry";
    };

    const toggleFilters = () => {
        searchViewOpen = false;
        activeSheet = activeSheet === "filters" ? null : "filters";
    };

    const openSearchView = () => {
        activeSheet = null;
        searchViewOpen = true;
    };

    const closeSearchView = () => {
        searchViewOpen = false;
    };

    const handleSelect = (food: FdcFood) => {
        selectedFood = food;
    };

    const handleCreate = (food: FdcFood) => {
        closeIngredientSheet();
        selectedFood = food;
    };

    const handleSearchSelect = (food: FdcFood) => {
        searchViewOpen = false;
        closeIngredientSheet();
        selectedFood = food;
    };

    const closeNutritionDetail = () => {
        selectedFood = null;
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
			const result = await renameFoodInSmoothieList(key, food.fdcId, name, food);
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

    const resetActiveListScroll = async () => {
        await tick();
        ingredientListElement?.scrollTo({ top: 0, behavior: "instant" });
    };

    const resetVisibleCounts = () => {
        onHandVisibleCount = LIST_PAGE_SIZES.ingredientPills;
        shoppingVisibleCount = LIST_PAGE_SIZES.ingredientPills;
        void resetActiveListScroll();
    };

    const revealMoreActiveItems = async () => {
        if (!canRevealMoreActiveItems || loadingMoreList) return;
        loadingMoreList = activeList;

        try {
            const currentRawLength = activeRawList.length;
            if (currentRawLength < activeTotalCount) {
                await loadListPage(activeList, false);
                return;
            }

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
        } finally {
            loadingMoreList = null;
        }
    };

    const handleActiveListScroll = (event: Event) => {
        const listElement = event.currentTarget;
        if (!(listElement instanceof HTMLElement)) return;

        const distanceFromBottom =
            listElement.scrollHeight -
            listElement.scrollTop -
            listElement.clientHeight;

        if (distanceFromBottom <= LIST_REVEAL_BUFFER_PX) {
            void revealMoreActiveItems();
        }
    };

    const applyListFilters = ({
        query,
        filterValue,
        sortValue,
    }: {
        query: string;
        filterValue: string;
        sortValue: string;
    }) => {
        const nextSort = sortValue as FoodListSort;
        const unchanged =
            listQuery === query &&
            sourceFilter === filterValue &&
            listSort === nextSort;

        listQuery = query;
        sourceFilter = filterValue;
        listSort = nextSort;
        activeSheet = null;

        if (unchanged) return;
        resetVisibleCounts();
        void loadLists();
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

    $effect(() => {
        const listElement = ingredientListElement;
        const sentinel = ingredientListSentinel;
        if (!listElement || !sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    void revealMoreActiveItems();
                }
            },
            {
                root: listElement,
                rootMargin: `${LIST_REVEAL_BUFFER_PX}px 0px`,
            },
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    });

    onMount(() => {
        resetVisibleCounts();
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

<ViewFrame appShell className="ingredients-page">
    <ViewTop>
        <ViewHeader
            title="Ingredients"
            subtitle="Search foods, add them to your fridge, and track shopping needs."
        />

        <section class="ingredient-search-panel" aria-labelledby="ingredient-search-title">
            <h2 id="ingredient-search-title" class="sr-only">Find Ingredients</h2>
            <div class="search-toolbar">
                <div class="search-toolbar__input">
                    <IngredientSearchTrigger onOpen={openSearchView} />
                </div>
                <BarcodeScanButton
                    scanning={barcodeLookupBusy}
                    compact
                    onclick={startBarcodeScan}
                />
                <button
                    class="filter-button"
                    class:filter-button--active={activeSheet === "filters"}
                    type="button"
                    aria-expanded={activeSheet === "filters"}
                    aria-controls="ingredient-filter-sheet-title"
                    onclick={toggleFilters}
                >
                    <span class="sr-only">Filter saved ingredients</span>
                    <Sliders class="filter-button__icon" />
                </button>
            </div>

            <ManualEntryLauncher onSelect={openManualEntry} />

        </section>
    </ViewTop>

    <ViewBody>
        <section
            class="saved-ingredients"
            aria-labelledby="saved-ingredients-title"
            aria-busy={listLoading}
        >
            <h2 id="saved-ingredients-title" class="sr-only">Saved ingredients</h2>
            <IngredientListTabs
                {activeList}
                fridgeCount={onHandTotalCount}
                shoppingListCount={shoppingListTotalCount}
                onSelect={selectList}
            />

            {#if listActionError}
                <p class="list-action-error" role="alert">{listActionError}</p>
            {/if}

            {#if listLoadingError}
                <p class="list-action-error" role="alert">{listLoadingError}</p>
            {/if}

            {#if listLoading}
                <p class="saved-ingredients__loading" role="status" aria-live="polite">
                    Loading saved ingredients…
                </p>
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
                        aria-busy={listLoading || loadingMoreList === activeList}
                        bind:this={ingredientListElement}
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
                                bind:this={ingredientListSentinel}
                                class="ingredient-card-list__sentinel"
                                aria-hidden="true"
                            ></li>
                            <li class="ingredient-card-list__load-more">
                                <button
                                    type="button"
                                    disabled={loadingMoreList !== null}
                                    onclick={() => void revealMoreActiveItems()}
                                >
                                    {loadingMoreList
                                        ? "Loading…"
                                        : `Load more ${getIngredientListLabel(activeList).toLowerCase()} items`}
                                </button>
                            </li>
                        {/if}
                    </ul>
                {:else if listLoading}
                    <div
                        class="ingredient-list-loading"
                        role="status"
                        aria-live="polite"
                    >
                        Loading {getIngredientListLabel(activeList).toLowerCase()} ingredients…
                    </div>
                {:else}
                    <IngredientEmptyState
                        {activeList}
                        hasItems={activeRawList.length > 0}
                    />
                {/if}
            </div>
        </section>
    </ViewBody>
</ViewFrame>

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

<ManualEntrySheet
    open={activeSheet === "manual-entry"}
    {scanSignal}
    onClose={closeIngredientSheet}
    onCreate={handleCreate}
    onLookupStateChange={(busy) => (barcodeLookupBusy = busy)}
/>

<IngredientFilterSheet
    open={activeSheet === "filters"}
    query={listQuery}
    filterValue={sourceFilter}
    filterOptions={INGREDIENT_SOURCE_FILTER_OPTIONS}
    sortValue={listSort}
    sortOptions={FOOD_LIST_SORT_OPTIONS}
    loading={listLoading}
    onApply={applyListFilters}
    onClose={closeIngredientSheet}
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

<RightSheet
    open={searchViewOpen}
    labelledby="ingredient-search-view-title"
    onClose={closeSearchView}
>
    <IngredientSearchView
        scanning={barcodeLookupBusy}
        filtersActive={activeSheet === "filters"}
        onSelect={handleSearchSelect}
        onScan={startBarcodeScan}
        onFilter={toggleFilters}
    />
</RightSheet>

<RightSheet
    open={selectedFood !== null}
    labelledby="nutrition-detail-view-title"
    onClose={closeNutritionDetail}
>
    {#if selectedFood}
        <NutritionDetailView food={selectedFood} onClose={closeNutritionDetail} />
    {/if}
</RightSheet>

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
        align-items: start;
        gap: $app-horizontal-control-gap;
    }

    .search-toolbar__input {
        min-width: 0;
    }

    .search-toolbar :global(.barcode-scan-button--compact) {
        align-self: start;
        width: $ingredient-control-height;
        height: $ingredient-control-height;
        min-height: $ingredient-control-height;
    }

    .filter-button {
        display: inline-grid;
        place-items: center;
        align-self: start;
        width: $ingredient-control-height;
        height: $ingredient-control-height;
        color: $ingredient-text-muted;
        background: $ingredient-surface-control;
        border: 0;
        border-radius: $ingredient-radius-control;
        transition:
            color 160ms ease,
            background-color 160ms ease,
            transform 160ms ease;

        :global(.filter-button__icon) {
            width: $ingredient-control-icon-size;
            height: $ingredient-control-icon-size;
        }

        &:hover,
        &--active {
            color: $ingredient-accent-primary;
            background: $ingredient-surface-positive;
        }

        &:active {
            transform: scale(0.97);
        }

        &:focus-visible {
            outline: $app-focus-outline;
            outline-offset: $app-gap-xs;
        }
    }

    .saved-ingredients {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-rows: auto auto auto minmax(0, 1fr);
        gap: $app-vertical-stack-gap;
        min-height: 0;
        padding-top: 0;
        overflow: hidden;
    }

    .saved-ingredients__body {
        grid-row: -2 / -1;
        height: 100%;
        min-height: 0;
        overflow: hidden;
    }

    .ingredient-card-list {
        display: grid;
        align-content: start;
        gap: $app-vertical-stack-gap;
        height: 100%;
        max-height: 100%;
        min-height: 0;
        margin: 0;
        padding: 0 0 $app-vertical-stack-gap;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-gutter: stable;
        -webkit-overflow-scrolling: touch;
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
            min-height: $ingredient-control-height-compact;
            padding: $ingredient-control-padding-y-compact $ingredient-control-padding-x;
            color: $ingredient-accent-primary;
            background: $ingredient-surface-positive;
            border: 0;
            border-radius: $ingredient-radius-pill;
            font-family: $app-button-font-family;
            font-size: $app-font-size-sm;
            font-weight: $app-button-font-weight;
            line-height: $app-button-line-height;
        }
    }

	.saved-ingredients__loading {
		margin: 0;
		color: $ingredient-text-muted;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-bold;
		line-height: 1.3;
	}

	.ingredient-list-loading {
		display: grid;
		place-items: center;
		min-height: 12rem;
		padding: $app-gap-lg;
		color: $ingredient-text-muted;
		background: $ingredient-surface-card;
		border-radius: $ingredient-radius-card;
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-bold;
		text-align: center;
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

    .add-ingredient-fab {
        position: fixed;
        right: max($ingredient-shell-padding-x, calc((100vw - $ingredient-shell-max-width) / 2 + $ingredient-shell-padding-x));
        bottom: calc($ingredient-shell-nav-height + $app-gap-md);
        z-index: 12;
        display: inline-grid;
        place-items: center;
        width: $ingredient-fab-size;
        height: $ingredient-fab-size;
        color: $ingredient-surface-card;
        background: $ingredient-accent-primary;
        border: 0;
        border-radius: $ingredient-radius-card;
        font-size: 2rem;
        font-weight: $app-font-weight-medium;
        line-height: 1;
    }

    @media (max-width: $app-breakpoint-xs) {
        .search-toolbar {
            gap: $app-horizontal-control-gap;
        }

        .filter-button {
            width: $ingredient-control-height;
            height: $ingredient-control-height;
        }
    }
</style>
