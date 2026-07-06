<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import Sliders from "$lib/assets/icons/Sliders.svelte";
    import Plus from "$lib/assets/icons/Plus.svelte";
    import CircleIconButton from "$lib/components/common/buttons/CircleIconButton.svelte";
    import IconControlButton from "$lib/components/common/buttons/IconControlButton.svelte";
    import RightSheet from "$lib/components/common/sheets/RightSheet.svelte";
    import ViewBody from "$lib/components/common/view/ViewBody.svelte";
    import ViewFrame from "$lib/components/common/view/ViewFrame.svelte";
    import ViewHeader from "$lib/components/common/view/ViewHeader.svelte";
    import ViewTop from "$lib/components/common/view/ViewTop.svelte";
    import BarcodeScanButton from "$lib/components/ingredients/barcode/BarcodeScanButton.svelte";
    import IngredientActionSheet from "$lib/components/ingredients/sheets/IngredientActionSheet.svelte";
    import IngredientFilterSheet from "$lib/components/ingredients/sheets/IngredientFilterSheet.svelte";
    import IngredientSearchTrigger from "$lib/components/ingredients/search/IngredientSearchTrigger.svelte";
    import IngredientSearchView from "$lib/components/ingredients/search/IngredientSearchView.svelte";
    import ManualEntryLauncher from "$lib/components/ingredients/manual-entry/ManualEntryLauncher.svelte";
    import ManualEntrySheet from "$lib/components/ingredients/sheets/ManualEntrySheet.svelte";
    import type { ManualEntryCreateContext } from "$lib/components/ingredients/manual-entry/types";
    import NutritionDetailView from "$lib/components/ingredients/nutrition/NutritionDetailView.svelte";
    import SavedIngredientList from "$lib/components/ingredients/list/SavedIngredientList.svelte";
    import SavedIngredientListLayout from "$lib/components/ingredients/list/SavedIngredientListLayout.svelte";
    import TextInputDialog from "$lib/components/common/dialogs/TextInputDialog.svelte";
    import { LIST_PAGE_SIZES } from "../../defaults/listDefaults";
    import type { FdcFood } from "$lib/utils/food/types";
    import {
        areFoodIdsEqual,
        getIngredientActionKey,
        getIngredientListLabel,
        getIngredientMoveLabel,
        getOppositeIngredientListKey,
        INGREDIENT_SOURCE_FILTER_OPTIONS,
        type IngredientListMembership,
        type IngredientActionItem,
    } from "$lib/utils/ingredients/ingredientListUi";
    import {
        buildIngredientRouteHref,
        findIngredientRouteFood,
        getIngredientRouteState,
        INGREDIENT_ROUTE_SHEETS,
        INGREDIENT_ROUTE_VIEWS,
        type IngredientRoutePatch,
    } from "$lib/utils/ingredients/ingredientRouteState";
    import {
        FOOD_LIST_SORT_OPTIONS,
        filterItemsByQuery,
        sortFoodListItems,
        type FoodListSort,
    } from "$lib/utils/list/listNavigation";
    import {
        cacheCustomFoodsLocally,
        readCustomFoods,
    } from "$lib/utils/food/custom/customFoods";
    import {
        addFoodToSmoothieList,
        readSmoothieList,
        removeFoodFromSmoothieList,
        renameFoodInSmoothieList,
        SMOOTHIE_LISTS_CHANGED_EVENT,
        type SmoothieListKey,
    } from "$lib/utils/storage/client/smoothieLists";
    import {
        reconcileCloudCustomFoods,
        readCloudSmoothieListPage,
    } from "$lib/utils/storage/supabase";
    import { onMount } from "svelte";
    import { getFoodPreferenceContext } from "$lib/utils/profile/foodPreferenceContext.svelte";
    import { MIX_STORAGE_KEYS } from "../../defaults/mixDefaults";

    let onHand = $state<FdcFood[]>([]);
    let shoppingList = $state<FdcFood[]>([]);
    let selectedFood = $state<FdcFood | null>(null);
    let selectedFoodShowListActions = $state(true);
    let scanSignal = $state(0);
    let barcodeLookupBusy = $state(false);
    let listQuery = $state("");
    let sourceFilter = $state("all");
    let listSort = $state<FoodListSort>("recent");
    let activeList = $state<SmoothieListKey>(MIX_STORAGE_KEYS.fridge);
    let activeSheet = $state<"manual-entry" | "filters" | null>(null);
    let searchViewOpen = $state(false);
    let searchAddFoodId = $state<number | null>(null);
    let onHandVisibleCount = $state<number>(LIST_PAGE_SIZES.ingredientPills);
    let shoppingVisibleCount = $state<number>(LIST_PAGE_SIZES.ingredientPills);
    let onHandTotalCount = $state(0);
    let shoppingListTotalCount = $state(0);
    let listLoading = $state(true);
    let listLoadingError = $state("");
    let listLoadRequestId = 0;
    let loadingMoreList = $state<SmoothieListKey | null>(null);
    let listViewResetKey = $state(0);
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
    const ingredientRouteState = $derived(getIngredientRouteState(page.url));

    const navigateIngredientRoute = (
        patch: IngredientRoutePatch,
        { replaceState = false }: { replaceState?: boolean } = {},
    ) => {
        const href = buildIngredientRouteHref(page.url, patch);
        const currentHref = `${page.url.pathname}${page.url.search}${page.url.hash}`;
        if (href === currentHref) return Promise.resolve();
        return goto(href, {
            replaceState,
            noScroll: true,
            keepFocus: true,
        });
    };

    const closeRoutedPopin = (replaceState = true) =>
        navigateIngredientRoute(
            {
                view: null,
                sheet: null,
                foodId: null,
                listKey: null,
                showListActions: true,
            },
            { replaceState },
        );

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
    const selectedFoodListMembership = $derived.by<IngredientListMembership>(() => {
        const foodId = selectedFood?.fdcId;
        if (!foodId) return { inFridge: false, inShoppingList: false };

        const inFridge =
            onHand.some((food) => food.fdcId === foodId) ||
            readSmoothieList(MIX_STORAGE_KEYS.fridge).some(
                (food) => food.fdcId === foodId,
            );
        const inShoppingList =
            shoppingList.some((food) => food.fdcId === foodId) ||
            readSmoothieList(MIX_STORAGE_KEYS.shoppingList).some(
                (food) => food.fdcId === foodId,
            );

        return { inFridge, inShoppingList };
    });
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

    const getRouteFood = () =>
        findIngredientRouteFood(
            ingredientRouteState.foodId,
            ingredientRouteState.listKey,
            onHand,
            shoppingList,
            readCustomFoods(),
        );

    const closeIngredientSheet = () => {
        activeSheet = null;
        void closeRoutedPopin();
    };

    const startBarcodeScan = () => {
        searchViewOpen = false;
        activeSheet = "manual-entry";
        scanSignal += 1;
        void navigateIngredientRoute({
            view: null,
            sheet: INGREDIENT_ROUTE_SHEETS.manualEntry,
            foodId: null,
            listKey: null,
        });
    };

    const openManualEntry = () => {
        activeSheet = "manual-entry";
        void navigateIngredientRoute({
            view: null,
            sheet: INGREDIENT_ROUTE_SHEETS.manualEntry,
            foodId: null,
            listKey: null,
        });
    };

    const toggleFilters = () => {
        searchViewOpen = false;
        const nextSheet = activeSheet === "filters" ? null : "filters";
        activeSheet = nextSheet;
        if (nextSheet) {
            void navigateIngredientRoute({
                view: null,
                sheet: INGREDIENT_ROUTE_SHEETS.filters,
                foodId: null,
                listKey: null,
            });
            return;
        }
        void closeRoutedPopin();
    };

    const openSearchView = () => {
        activeSheet = null;
        searchViewOpen = true;
        void navigateIngredientRoute({
            view: INGREDIENT_ROUTE_VIEWS.search,
            sheet: null,
            foodId: null,
            listKey: null,
        });
    };

    const closeSearchView = () => {
        searchViewOpen = false;
        void closeRoutedPopin();
    };

    const handleSelect = (food: FdcFood, listKey: SmoothieListKey | null = null) => {
        selectedFood = food;
        selectedFoodShowListActions = true;
        void navigateIngredientRoute({
            view: INGREDIENT_ROUTE_VIEWS.nutrition,
            sheet: null,
            foodId: food.fdcId,
            listKey,
            showListActions: true,
        });
    };

    const handleCreate = (
        food: FdcFood,
        context: ManualEntryCreateContext,
    ) => {
        activeSheet = null;
        selectedFood = food;
        selectedFoodShowListActions = !context.addedToList;
        void navigateIngredientRoute({
            view: INGREDIENT_ROUTE_VIEWS.nutrition,
            sheet: null,
            foodId: food.fdcId,
            listKey: null,
            showListActions: !context.addedToList,
        });
    };

    const handleSearchSelect = (food: FdcFood) => {
        searchViewOpen = false;
        activeSheet = null;
        selectedFood = food;
        selectedFoodShowListActions = true;
        void navigateIngredientRoute({
            view: INGREDIENT_ROUTE_VIEWS.nutrition,
            sheet: null,
            foodId: food.fdcId,
            listKey: null,
            showListActions: true,
        });
    };

    const addSearchResultToFridge = async (food: FdcFood) => {
        if (searchAddFoodId !== null) return;

        searchAddFoodId = food.fdcId;
        listActionError = "";
        try {
            const result = await addFoodToSmoothieList(MIX_STORAGE_KEYS.fridge, food);
            if (result === "error") {
                listActionError = `${food.description} could not be added to fridge. Try again.`;
                return;
            }
            await loadLists();
        } finally {
            searchAddFoodId = null;
        }
    };

    const closeNutritionDetail = () => {
        selectedFood = null;
        selectedFoodShowListActions = true;
        void closeRoutedPopin();
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
			if (selectedFood?.fdcId === foodId) {
                selectedFood = null;
                void closeRoutedPopin();
            }
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
        void navigateIngredientRoute({
            view: null,
            sheet: INGREDIENT_ROUTE_SHEETS.renameIngredient,
            foodId: food.fdcId,
            listKey: key,
        });
	};

	const closeRenameDialog = () => {
		if (renameBusy) return;
		renamingItem = null;
		renameError = "";
        void closeRoutedPopin();
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
            void closeRoutedPopin();
			await loadLists();
		} finally {
			renameBusy = false;
		}
	};

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

            if (selectedFood?.fdcId === food.fdcId) {
                selectedFood = null;
                void closeRoutedPopin();
            }
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
        void navigateIngredientRoute({
            view: null,
            sheet: INGREDIENT_ROUTE_SHEETS.ingredientActions,
            foodId: food.fdcId,
            listKey: key,
        });
    };

    const closeActionSheet = () => {
        if (movingItem || removingItem) return;
        actionSheetItem = null;
        void closeRoutedPopin();
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
        void closeRoutedPopin();
        await moveFoodBetweenLists(currentItem.key, currentItem.food);
    };

    const removeFromActionSheet = async () => {
        if (!actionSheetItem) return;
        const currentItem = actionSheetItem;
        actionSheetItem = null;
        void closeRoutedPopin();
        await removeFromList(currentItem.key, currentItem.food.fdcId);
    };

    const selectList = (key: SmoothieListKey) => {
        if (activeList === key) return;
        activeList = key;
        listViewResetKey += 1;
    };

    const resetVisibleCounts = () => {
        onHandVisibleCount = LIST_PAGE_SIZES.ingredientPills;
        shoppingVisibleCount = LIST_PAGE_SIZES.ingredientPills;
        listViewResetKey += 1;
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
        void closeRoutedPopin();

        if (unchanged) return;
        resetVisibleCounts();
        void loadLists();
    };

    $effect(() => {
        const routeState = ingredientRouteState;
        const routeFood = getRouteFood();

        searchViewOpen = routeState.view === INGREDIENT_ROUTE_VIEWS.search;

        activeSheet =
            routeState.sheet === INGREDIENT_ROUTE_SHEETS.manualEntry ||
            routeState.sheet === INGREDIENT_ROUTE_SHEETS.filters
                ? routeState.sheet
                : null;

        if (routeState.view === INGREDIENT_ROUTE_VIEWS.nutrition) {
            const nextFood =
                selectedFood?.fdcId === routeState.foodId ? selectedFood : routeFood;
            selectedFood = nextFood;
            selectedFoodShowListActions = routeState.showListActions;
        } else {
            selectedFood = null;
            selectedFoodShowListActions = true;
        }

        if (
            routeState.sheet === INGREDIENT_ROUTE_SHEETS.ingredientActions &&
            routeState.listKey &&
            routeFood
        ) {
            actionSheetItem = { key: routeState.listKey, food: routeFood };
        } else if (routeState.sheet !== INGREDIENT_ROUTE_SHEETS.renameIngredient) {
            actionSheetItem = null;
        }

        if (
            routeState.sheet === INGREDIENT_ROUTE_SHEETS.renameIngredient &&
            routeState.listKey &&
            routeFood
        ) {
            const isSameRenameItem =
                renamingItem?.key === routeState.listKey &&
                renamingItem.food.fdcId === routeFood.fdcId;
            if (!isSameRenameItem) {
                renamingItem = { key: routeState.listKey, food: routeFood };
                renameError = "";
            }
            actionSheetItem = null;
        } else if (!renameBusy) {
            renamingItem = null;
        }
    });

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
                <IconControlButton
                    class="filter-button"
                    label="Filter saved ingredients"
                    active={activeSheet === "filters"}
                    aria-expanded={activeSheet === "filters"}
                    aria-controls="ingredient-filter-sheet-title"
                    onclick={toggleFilters}
                >
                    <Sliders class="filter-button__icon" />
                </IconControlButton>
            </div>

            <ManualEntryLauncher onSelect={openManualEntry} />

        </section>
    </ViewTop>

    <ViewBody>
        <SavedIngredientListLayout
            {activeList}
            fridgeCount={onHandTotalCount}
            shoppingListCount={shoppingListTotalCount}
            {listLoading}
            {listActionError}
            {listLoadingError}
            onSelectList={selectList}
        >
            <SavedIngredientList
                {activeList}
                foods={activeVisibleList}
                activeRawCount={activeRawList.length}
                {listLoading}
                {loadingMoreList}
                canRevealMore={canRevealMoreActiveItems}
                selectedFoodId={selectedFood?.fdcId ?? null}
                selectedIds={selectedActiveItemIds}
                {removingItem}
                moving={movingItem !== null}
                preferenceProfile={foodPreferenceContext.current}
                resetKey={listViewResetKey}
                onSelectAll={selectAllActiveItems}
                onClearSelection={clearActiveSelection}
                onMoveSelection={moveSelectedItems}
                onToggle={(foodId) => toggleBulkSelection(activeList, foodId)}
                onPreview={(food) => handleSelect(food)}
                onActions={(food) => openActionSheet(activeList, food)}
                onRemove={(foodId) => removeFromList(activeList, foodId)}
                onRevealMore={revealMoreActiveItems}
            />
        </SavedIngredientListLayout>
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

<div class="add-ingredient-fab">
    <CircleIconButton
        label="Add ingredient manually"
        variant="primary"
        size="fab"
        onclick={openManualEntry}
    >
        <Plus size={28} strokeWidth={2.4} />
    </CircleIconButton>
</div>

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
        onAdd={addSearchResultToFridge}
        addingFoodId={searchAddFoodId}
        onScan={startBarcodeScan}
        onFilter={toggleFilters}
        onClose={closeSearchView}
    />
</RightSheet>

<RightSheet
    open={selectedFood !== null}
    labelledby="nutrition-detail-view-title"
    onClose={closeNutritionDetail}
>
    {#if selectedFood}
        <NutritionDetailView
            food={selectedFood}
            showListActions={selectedFoodShowListActions}
            listMembership={selectedFoodListMembership}
            onClose={closeNutritionDetail}
        />
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
        align-items: center;
        gap: $app-horizontal-control-gap;
    }

    .search-toolbar__input {
        min-width: 0;
    }

    .search-toolbar :global(.barcode-scan-button--compact) {
        width: $ingredient-control-height;
        height: $ingredient-control-height;
        min-height: $ingredient-control-height;
    }

    :global(.filter-button__icon) {
        width: $ingredient-control-icon-size;
        height: $ingredient-control-icon-size;
    }

	.add-ingredient-fab {
		position: fixed;
		right: max(
			$ingredient-shell-padding-x,
			calc((100vw - $ingredient-shell-max-width) / 2 + $ingredient-shell-padding-x)
		);
		bottom: calc($ingredient-shell-nav-height + $app-gap-md);
		z-index: 12;
	}

	@media (max-width: $app-breakpoint-xs) {
		.search-toolbar {
			gap: $app-horizontal-control-gap;
		}
	}
</style>
