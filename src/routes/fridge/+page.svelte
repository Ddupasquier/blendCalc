<script lang="ts">
    import {
        pushState,
        replaceState as replaceNavigationState,
    } from "$app/navigation";
    import { page } from "$app/state";
    import ViewBody from "$lib/components/common/view/ViewBody/ViewBody.svelte";
    import ViewFrame from "$lib/components/common/view/ViewFrame/ViewFrame.svelte";
    import ViewHeader from "$lib/components/common/view/ViewHeader/ViewHeader.svelte";
    import ViewTop from "$lib/components/common/view/ViewTop/ViewTop.svelte";
    import { getAppDocumentTitle } from "$lib/config/pageMetadata";
    import type { ManualEntryCreateContext } from "$lib/components/ingredients/manual-entry/types";
    import IngredientsFloatingAddButton from "$lib/components/ingredients/page/IngredientsFloatingAddButton/IngredientsFloatingAddButton.svelte";
    import IngredientsSearchPanel from "$lib/components/ingredients/page/IngredientsSearchPanel/IngredientsSearchPanel.svelte";
    import IngredientRoutePopins from "$lib/components/ingredients/page/IngredientRoutePopins/IngredientRoutePopins.svelte";
    import type {
        IngredientRouteNavigationOptions,
    } from "$lib/components/ingredients/page/types";
    import type { IngredientFilterApplyPayload } from "$lib/components/ingredients/sheets/types";
    import SavedIngredientList from "$lib/components/ingredients/list/SavedIngredientList/SavedIngredientList.svelte";
    import SavedIngredientListLayout from "$lib/components/ingredients/list/SavedIngredientListLayout/SavedIngredientListLayout.svelte";
    import { LIST_PAGE_SIZES } from "$lib/config/listPagination";
    import type { FdcFood, FoodImageAsset } from "$lib/utils/food/types";
    import { getFoodIdentityKey } from "$lib/utils/food/records/foodIdentity";
    import {
        areFoodIdsEqual,
        getIngredientActionKey,
        getIngredientListLabel,
        getOppositeIngredientListKey,
        type IngredientListMembership,
        type IngredientActionItem,
    } from "$lib/utils/ingredients/ingredientListUi";
    import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";
    import {
        buildIngredientRouteHref,
        findIngredientRouteFood,
		getIngredientListTab,
        getIngredientRouteState,
        INGREDIENT_ROUTE_MODALS,
        INGREDIENT_ROUTE_SHEETS,
        INGREDIENT_ROUTE_VIEWS,
        type IngredientRoutePatch,
    } from "$lib/utils/ingredients/ingredientRouteState";
    import {
        FOOD_LIST_SORT_OPTIONS,
        type FoodListSort,
    } from "$lib/utils/list/listNavigation";
    import type { ScrollDirection } from "$lib/utils/navigation/scrollDirection";
    import {
        addFoodToSmoothieList,
		moveFoodToSmoothieList,
		moveFoodsToSmoothieList,
        removeFoodFromSmoothieList,
        renameFoodInSmoothieList,
        SMOOTHIE_LISTS_CHANGED_EVENT,
        type SmoothieListKey,
    } from "$lib/utils/storage/client/smoothieLists";
    import {
		readCloudCustomFoods,
		readCloudSmoothieListIndex,
		type CloudSmoothieListIndex,
    } from "$lib/utils/storage/supabase";
	import {
		readIngredientListPage,
		readIngredientListWindow,
	} from "$lib/utils/ingredients/ingredientListApi";
    import { onMount } from "svelte";
    import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";

	const initialIngredientData = page.data.ingredientData;
    let onHand = $state<FdcFood[]>(initialIngredientData?.fridge.foods ?? []);
    let shoppingList = $state<FdcFood[]>(
		initialIngredientData?.shoppingList.foods ?? [],
	);
	let customFoods = $state<FdcFood[]>(initialIngredientData?.customFoods ?? []);
	let listIndex = $state<CloudSmoothieListIndex>(
		initialIngredientData?.listIndex ?? {
			[MIX_STORAGE_KEYS.fridge]: { foodIds: [], foodIdentityKeys: [] },
			[MIX_STORAGE_KEYS.shoppingList]: { foodIds: [], foodIdentityKeys: [] },
		},
	);
    let selectedFood = $state<FdcFood | null>(null);
    let selectedFoodShowListActions = $state(true);
    let scanSignal = $state(0);
    let barcodeScannerRouteOpen = $state(false);
    let barcodeLookupBusy = $state(false);
    let listQuery = $state("");
    const sourceFilter = "all";
    const trustFilter = "any";
    let listSort = $state<FoodListSort>("recent");
    let activeList = $derived<SmoothieListKey>(getIngredientListTab(page.url));
    let previousActiveList = $state<SmoothieListKey>(
		getIngredientListTab(page.url),
	);
    let activeSheet = $state<"manual-entry" | "filters" | null>(null);
    let searchViewOpen = $state(false);
    let compactTopHidden = $state(false);
    let searchAddFoodId = $state<number | null>(null);
    let onHandVisibleCount = $state<number>(LIST_PAGE_SIZES.ingredientPills);
    let shoppingVisibleCount = $state<number>(LIST_PAGE_SIZES.ingredientPills);
    let onHandTotalCount = $state(initialIngredientData?.fridge.totalCount ?? 0);
    let shoppingListTotalCount = $state(
		initialIngredientData?.shoppingList.totalCount ?? 0,
	);
    let listLoading = $state(false);
    let listLoadingError = $state(initialIngredientData?.loadError ?? "");
    let provenanceOptions = $state<IngredientProvenanceOption[]>(
		initialIngredientData?.provenanceOptions ?? [],
	);
    let provenanceOptionsError = $state(
		initialIngredientData?.provenanceError ?? "",
	);
    let listLoadRequestId = 0;
    let loadingMoreList = $state<SmoothieListKey | null>(null);
    let listViewResetKey = $state(0);
    let selectedListItemIds = $state<Record<SmoothieListKey, number[]>>({
        [MIX_STORAGE_KEYS.fridge]: [],
        [MIX_STORAGE_KEYS.shoppingList]: [],
    });
	let selectionMode = $state(false);
    let actionSheetItem = $state<IngredientActionItem | null>(null);
    let imagePlacementItem = $state<IngredientActionItem | null>(null);
    let movingItem = $state<string | null>(null);
	let removingItem = $state<string | null>(null);
	let renamingItem = $state<{ key: SmoothieListKey; food: FdcFood } | null>(null);
	let renameBusy = $state(false);
	let renameError = $state("");
    let listActionError = $state("");
    const ingredientRouteState = $derived(getIngredientRouteState(page.url));
    const documentTitle = $derived(
        getAppDocumentTitle(page.url, selectedFood?.description),
    );

    const navigateIngredientRoute = (
        patch: IngredientRoutePatch,
        { replaceState = false }: IngredientRouteNavigationOptions = {},
    ) => {
        const href = buildIngredientRouteHref(page.url, patch);
        const currentHref = `${page.url.pathname}${page.url.search}${page.url.hash}`;
        if (href === currentHref) return;

        const nextPageState = { ...page.state };
        if (replaceState) {
            replaceNavigationState(href, nextPageState);
            return;
        }

        pushState(href, nextPageState);
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
    const showListLoadingIndicator = $derived(
        listLoading && onHand.length === 0 && shoppingList.length === 0,
    );
    const selectedActiveItemIds = $derived.by(
        () => selectedListItemIds[activeList] ?? [],
    );
    const selectedFoodListMembership = $derived.by<IngredientListMembership>(() => {
        const foodId = selectedFood?.fdcId;
        if (!foodId) return { inFridge: false, inShoppingList: false };

        const inFridge = listIndex[MIX_STORAGE_KEYS.fridge].foodIds.includes(foodId);
        const inShoppingList = listIndex[
			MIX_STORAGE_KEYS.shoppingList
		].foodIds.includes(foodId);

        return { inFridge, inShoppingList };
    });
    const savedFoodIdentityKeys = $derived.by(() =>
        new Set(
			[
				...listIndex[MIX_STORAGE_KEYS.fridge].foodIdentityKeys,
				...listIndex[MIX_STORAGE_KEYS.shoppingList].foodIdentityKeys,
			],
        ),
    );
    const canRevealMoreActiveItems = $derived(
        activeVisibleList.length < activeFilteredList.length ||
            activeRawList.length < activeTotalCount,
    );
    const canAdjustImagePlacement = $derived(
        page.data.authUser?.role === "admin" ||
            page.data.authUser?.role === "moderator",
    );
    const ingredientOverlayOpen = $derived(
        activeSheet !== null ||
            actionSheetItem !== null ||
            imagePlacementItem !== null ||
            renamingItem !== null ||
            searchViewOpen ||
            selectedFood !== null,
    );

	$effect(() => {
		const routeList = activeList;
		if (routeList === previousActiveList) return;
		selectedListItemIds = {
			...selectedListItemIds,
			[previousActiveList]: [],
		};
		selectionMode = false;
		previousActiveList = routeList;
		listViewResetKey += 1;
	});

    const setListPage = (
        key: SmoothieListKey,
        foods: FdcFood[],
        totalCount: number,
        replace: boolean,
        resetViewport: boolean,
    ) => {
        if (key === MIX_STORAGE_KEYS.fridge) {
            onHand = replace ? foods : [...onHand, ...foods];
            onHandTotalCount = totalCount;
            onHandVisibleCount = resetViewport
                ? LIST_PAGE_SIZES.ingredientPills
                : Math.max(onHandVisibleCount, onHand.length);
            return;
        }

        shoppingList = replace ? foods : [...shoppingList, ...foods];
        shoppingListTotalCount = totalCount;
        shoppingVisibleCount = resetViewport
            ? LIST_PAGE_SIZES.ingredientPills
            : Math.max(shoppingVisibleCount, shoppingList.length);
    };

    const loadListPage = async (
        key: SmoothieListKey,
        replace = false,
        requestId = listLoadRequestId,
        resetViewport = false,
    ) => {
        const currentFoods =
            key === MIX_STORAGE_KEYS.fridge ? onHand : shoppingList;
        const currentOffset = replace
            ? 0
            : currentFoods.length;
        const pageSize = replace
            ? resetViewport
                ? LIST_PAGE_SIZES.ingredientPills
                : Math.max(
                        LIST_PAGE_SIZES.ingredientPills,
                        currentFoods.length,
                    )
            : LIST_PAGE_SIZES.ingredientLoadMore;
        const readPage = replace
            ? readIngredientListWindow
            : readIngredientListPage;
        const cloudPage = await readPage(key, {
            limit: pageSize,
            offset: currentOffset,
            query: listQuery,
            sort: listSort,
            sourceFilter,
            trustFilter,
        });
        if (!cloudPage) throw new Error("Saved ingredients are unavailable.");

        if (requestId !== listLoadRequestId) return;
        setListPage(
            key,
            cloudPage.foods,
            cloudPage.totalCount,
            replace,
            resetViewport,
        );
    };

    const loadLists = async ({
        resetViewport = false,
    }: { resetViewport?: boolean } = {}) => {
        const requestId = ++listLoadRequestId;
        listLoading = true;
        listLoadingError = "";
        if (resetViewport) resetVisibleCounts();
        try {
            const [nextCustomFoods, nextListIndex] = await Promise.all([
				readCloudCustomFoods(),
				readCloudSmoothieListIndex(),
                loadListPage(
                    MIX_STORAGE_KEYS.fridge,
                    true,
                    requestId,
                    resetViewport,
                ),
                loadListPage(
                    MIX_STORAGE_KEYS.shoppingList,
                    true,
                    requestId,
                    resetViewport,
                ),
            ]);
			if (!nextCustomFoods || !nextListIndex) {
				throw new Error("Saved ingredients are unavailable.");
			}

            if (requestId !== listLoadRequestId) return;
			customFoods = nextCustomFoods;
			listIndex = nextListIndex;
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

    const handleSmoothieListsChanged = () => {
        void loadLists();
    };

    const getRouteFood = () =>
        findIngredientRouteFood(
            ingredientRouteState.foodId,
            ingredientRouteState.listKey,
            onHand,
            shoppingList,
			customFoods,
        );

    const closeIngredientSheet = () => {
        barcodeScannerRouteOpen = false;
        scanSignal = 0;
        activeSheet = null;
        void closeRoutedPopin();
    };

    const startBarcodeScan = () => {
        searchViewOpen = false;
        activeSheet = "manual-entry";
        barcodeScannerRouteOpen = true;
        scanSignal += 1;
        void navigateIngredientRoute({
            view: null,
            sheet: INGREDIENT_ROUTE_SHEETS.manualEntry,
            modal: INGREDIENT_ROUTE_MODALS.barcodeScanner,
            foodId: null,
            listKey: null,
        });
    };

    const closeBarcodeScanner = () => {
        barcodeScannerRouteOpen = false;
        scanSignal = 0;
        void navigateIngredientRoute({
            view: null,
            sheet: INGREDIENT_ROUTE_SHEETS.manualEntry,
            modal: null,
            foodId: null,
            listKey: null,
        });
    };

    const openManualEntry = () => {
        barcodeScannerRouteOpen = false;
        scanSignal = 0;
        activeSheet = "manual-entry";
        void navigateIngredientRoute({
            view: null,
            sheet: INGREDIENT_ROUTE_SHEETS.manualEntry,
            modal: null,
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

    const handleListScrollDirectionChange = (
        direction: ScrollDirection,
    ) => {
        compactTopHidden = direction === "down";
    };

    const closeSearchView = () => {
        searchViewOpen = false;
        void closeRoutedPopin();
    };

    const handleSelect = (food: FdcFood, listKey: SmoothieListKey | null = null) => {
        const showListActions = listKey === null;
        selectedFood = food;
        selectedFoodShowListActions = showListActions;
        void navigateIngredientRoute({
            view: INGREDIENT_ROUTE_VIEWS.nutrition,
            sheet: null,
            foodId: food.fdcId,
            listKey,
            showListActions,
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

    const addFoodToListState = (key: SmoothieListKey, food: FdcFood) => {
        const currentFoods =
            key === MIX_STORAGE_KEYS.fridge ? onHand : shoppingList;
        if (!currentFoods.some((candidate) => candidate.fdcId === food.fdcId)) {
            const addedFood = {
                ...food,
                listAddedAt: food.listAddedAt ?? Date.now(),
            };
            if (key === MIX_STORAGE_KEYS.fridge) {
                onHand = [addedFood, ...onHand];
                onHandTotalCount += 1;
            } else {
                shoppingList = [addedFood, ...shoppingList];
                shoppingListTotalCount += 1;
            }
        }

        const currentIndex = listIndex[key];
        if (currentIndex.foodIds.includes(food.fdcId)) return;
        listIndex = {
            ...listIndex,
            [key]: {
                foodIds: [food.fdcId, ...currentIndex.foodIds],
                foodIdentityKeys: [
                    getFoodIdentityKey(food),
                    ...currentIndex.foodIdentityKeys,
                ],
            },
        };
    };

    const removeFoodFromListState = (
        key: SmoothieListKey,
        foodId: number,
    ) => {
        if (key === MIX_STORAGE_KEYS.fridge) {
            onHand = onHand.filter((food) => food.fdcId !== foodId);
            onHandTotalCount = Math.max(0, onHandTotalCount - 1);
        } else {
            shoppingList = shoppingList.filter((food) => food.fdcId !== foodId);
            shoppingListTotalCount = Math.max(0, shoppingListTotalCount - 1);
        }

        const currentIndex = listIndex[key];
        listIndex = {
            ...listIndex,
            [key]: {
                foodIds: currentIndex.foodIds.filter((id) => id !== foodId),
                foodIdentityKeys: currentIndex.foodIdentityKeys.filter(
                    (_, index) => currentIndex.foodIds[index] !== foodId,
                ),
            },
        };
    };

    const renameFoodInListState = (
        key: SmoothieListKey,
        foodId: number,
        description: string,
    ) => {
        const rename = (foods: FdcFood[]) =>
            foods.map((food) =>
                food.fdcId === foodId
                    ? {
                            ...food,
                            description,
                            nameProvenance: "user" as const,
                        }
                    : food,
            );

        if (key === MIX_STORAGE_KEYS.fridge) {
            onHand = rename(onHand);
        } else {
            shoppingList = rename(shoppingList);
        }
    };

    const addSearchResultToFridge = async (food: FdcFood) => {
        if (searchAddFoodId !== null) return;

        searchAddFoodId = food.fdcId;
        listActionError = "";
        try {
            const result = await addFoodToSmoothieList(
                MIX_STORAGE_KEYS.fridge,
                food,
                { notify: false },
            );
            if (result === "error") {
                listActionError = `${food.description} could not be added to fridge. Try again.`;
                return;
            }
			if (result === "move-required:shopping") {
				listActionError = `${food.description} is already in Shopping List. Open its nutrition view to move it to Fridge.`;
				return;
			}
            if (result === "added") {
                addFoodToListState(MIX_STORAGE_KEYS.fridge, food);
            }
        } finally {
            searchAddFoodId = null;
        }
    };

    const updateFoodImageInList = (
        foods: FdcFood[],
        foodId: number,
        image: FoodImageAsset,
    ) =>
        foods.map((food) =>
            food.fdcId === foodId
                ? {
                        ...food,
                        image,
                    }
                : food,
        );

    const withUpdatedImage = (food: FdcFood, image: FoodImageAsset) => ({
        ...food,
        image,
    });

    const handleImagePlacementSave = (image: FoodImageAsset, foodId?: number) => {
        const targetFoodId = foodId ?? selectedFood?.fdcId;
        if (!targetFoodId) return;

        if (selectedFood?.fdcId === targetFoodId) {
            selectedFood = withUpdatedImage(selectedFood, image);
        }
        if (imagePlacementItem?.food.fdcId === targetFoodId) {
            imagePlacementItem = {
                ...imagePlacementItem,
                food: withUpdatedImage(imagePlacementItem.food, image),
            };
        }
        if (actionSheetItem?.food.fdcId === targetFoodId) {
            actionSheetItem = {
                ...actionSheetItem,
                food: withUpdatedImage(actionSheetItem.food, image),
            };
        }
        onHand = updateFoodImageInList(onHand, targetFoodId, image);
        shoppingList = updateFoodImageInList(shoppingList, targetFoodId, image);
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
			const result = await removeFoodFromSmoothieList(key, foodId, {
                notify: false,
            });
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
            removeFoodFromListState(key, foodId);
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
			const result = await renameFoodInSmoothieList(
                key,
                food.fdcId,
                name,
                food,
                { notify: false },
            );
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

            const description = name.trim().replace(/\s+/g, " ");
			if (selectedFood?.fdcId === food.fdcId) {
				selectedFood = {
					...selectedFood,
					description,
					nameProvenance: "user",
				};
			}
            renameFoodInListState(key, food.fdcId, description);
			renamingItem = null;
            void closeRoutedPopin();
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
		selectionMode = true;
        setSelectedIds(
            activeList,
			activeVisibleList.map((food) => food.fdcId),
        );
    };

    const clearActiveSelection = () => {
        setSelectedIds(activeList, []);
    };

	const enterSelectionMode = (foodId?: number) => {
		if (movingItem || removingItem) return;
		selectionMode = true;
		if (foodId === undefined) return;
		const currentIds = selectedListItemIds[activeList] ?? [];
		if (!currentIds.includes(foodId)) {
			setSelectedIds(activeList, [...currentIds, foodId]);
		}
	};

	const cancelSelectionMode = () => {
		clearActiveSelection();
		selectionMode = false;
	};

	const applyBulkListMove = (
		sourceKey: SmoothieListKey,
		foods: FdcFood[],
	) => {
		const movedIds = new Set(foods.map((food) => food.fdcId));
		const movedAt = Date.now();
		const movedFoods = foods.map((food) => ({ ...food, listAddedAt: movedAt }));
		const targetKey = getOppositeIngredientListKey(sourceKey);

		if (sourceKey === MIX_STORAGE_KEYS.fridge) {
			onHand = onHand.filter((food) => !movedIds.has(food.fdcId));
			shoppingList = [
				...movedFoods,
				...shoppingList.filter((food) => !movedIds.has(food.fdcId)),
			];
			onHandTotalCount = Math.max(0, onHandTotalCount - movedFoods.length);
			shoppingListTotalCount += movedFoods.length;
		} else {
			shoppingList = shoppingList.filter((food) => !movedIds.has(food.fdcId));
			onHand = [
				...movedFoods,
				...onHand.filter((food) => !movedIds.has(food.fdcId)),
			];
			shoppingListTotalCount = Math.max(
				0,
				shoppingListTotalCount - movedFoods.length,
			);
			onHandTotalCount += movedFoods.length;
		}

		const sourceIndex = listIndex[sourceKey];
		const targetIndex = listIndex[targetKey];
		const movedIdentityKeys = foods.map(getFoodIdentityKey);
		const movedIdentityKeySet = new Set(movedIdentityKeys);
		listIndex = {
			...listIndex,
			[sourceKey]: {
				foodIds: sourceIndex.foodIds.filter((id) => !movedIds.has(id)),
				foodIdentityKeys: sourceIndex.foodIdentityKeys.filter(
					(_, index) => !movedIds.has(sourceIndex.foodIds[index]),
				),
			},
			[targetKey]: {
				foodIds: [
					...foods.map((food) => food.fdcId),
					...targetIndex.foodIds.filter((id) => !movedIds.has(id)),
				],
				foodIdentityKeys: [
					...movedIdentityKeys,
					...targetIndex.foodIdentityKeys.filter(
						(identityKey) => !movedIdentityKeySet.has(identityKey),
					),
				],
			},
		};
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
            const moveResult = await moveFoodToSmoothieList(targetKey, food, {
				notify: false,
			});
            if (moveResult === "error") {
                listActionError = `${food.description} could not be moved. Try again.`;
                return false;
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
			applyBulkListMove(sourceKey, [food]);
            return true;
        } finally {
            movingItem = null;
        }
    };

    const moveSelectedItems = async (): Promise<boolean> => {
		const sourceKey = activeList;
		const targetKey = getOppositeIngredientListKey(sourceKey);
        const selectedIds = selectedListItemIds[sourceKey] ?? [];
        if (selectedIds.length === 0 || movingItem) return false;

        const selectedFoods = activeRawList.filter((food) =>
            selectedIds.includes(food.fdcId),
        );
		if (selectedFoods.length !== selectedIds.length) {
			listActionError = "One or more selected ingredients are no longer available.";
			return false;
		}

		movingItem = `${sourceKey}:bulk`;
		listActionError = "";
		try {
			const moveResult = await moveFoodsToSmoothieList(targetKey, selectedFoods, {
				notify: false,
			});
			if (moveResult === "error") {
				listActionError = "The selected ingredients could not be moved. Try again.";
				return false;
			}

			applyBulkListMove(sourceKey, selectedFoods);
			setSelectedIds(sourceKey, []);
			selectionMode = false;
			return true;
		} finally {
			movingItem = null;
		}
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

	const selectFromActionSheet = () => {
		if (!actionSheetItem) return;
		const currentItem = actionSheetItem;
		actionSheetItem = null;
		selectionMode = true;
		const currentIds = selectedListItemIds[currentItem.key] ?? [];
		setSelectedIds(currentItem.key, [
			...currentIds.filter((id) => id !== currentItem.food.fdcId),
			currentItem.food.fdcId,
		]);
		void closeRoutedPopin();
	};

    const openImagePlacementFromActionSheet = () => {
        if (!actionSheetItem) return;
        const currentItem = actionSheetItem;
        imagePlacementItem = currentItem;
        actionSheetItem = null;
        void navigateIngredientRoute({
            view: null,
            sheet: INGREDIENT_ROUTE_SHEETS.imagePlacement,
            foodId: currentItem.food.fdcId,
            listKey: currentItem.key,
        });
    };

    const closeImagePlacementSheet = () => {
        imagePlacementItem = null;
        void closeRoutedPopin();
    };

    const renameFromActionSheet = () => {
        if (!actionSheetItem) return;
        openRenameDialog(actionSheetItem.key, actionSheetItem.food);
        actionSheetItem = null;
    };

    const removeFromActionSheet = async () => {
        if (!actionSheetItem) return;
        const currentItem = actionSheetItem;
        actionSheetItem = null;
        void closeRoutedPopin();
        await removeFromList(currentItem.key, currentItem.food.fdcId);
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
                    onHandVisibleCount + LIST_PAGE_SIZES.ingredientLoadMore,
                );
                return;
            }

            shoppingVisibleCount = Math.min(
                filteredShoppingList.length,
                shoppingVisibleCount + LIST_PAGE_SIZES.ingredientLoadMore,
            );
        } finally {
            loadingMoreList = null;
        }
    };

    const applyListFilters = ({
        query,
        sortValue,
    }: IngredientFilterApplyPayload) => {
        const nextSort = sortValue as FoodListSort;
        const unchanged =
            listQuery === query &&
            listSort === nextSort;

        listQuery = query;
        listSort = nextSort;
        activeSheet = null;
        void closeRoutedPopin();

        if (unchanged) return;
        void loadLists({ resetViewport: true });
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

        if (routeState.modal === INGREDIENT_ROUTE_MODALS.barcodeScanner) {
            if (!barcodeScannerRouteOpen) {
                barcodeScannerRouteOpen = true;
                scanSignal += 1;
            }
        } else {
            barcodeScannerRouteOpen = false;
            scanSignal = 0;
        }

        if (routeState.view === INGREDIENT_ROUTE_VIEWS.nutrition) {
            const nextFood =
                routeFood ??
                (selectedFood?.fdcId === routeState.foodId ? selectedFood : null);
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
        } else if (
            routeState.sheet !== INGREDIENT_ROUTE_SHEETS.renameIngredient &&
            routeState.sheet !== INGREDIENT_ROUTE_SHEETS.imagePlacement
        ) {
            actionSheetItem = null;
        }

        if (
            routeState.sheet === INGREDIENT_ROUTE_SHEETS.imagePlacement &&
            routeState.listKey &&
            routeFood
        ) {
            imagePlacementItem = { key: routeState.listKey, food: routeFood };
            actionSheetItem = null;
        } else {
            imagePlacementItem = null;
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
		window.addEventListener(
            SMOOTHIE_LISTS_CHANGED_EVENT,
            handleSmoothieListsChanged,
        );
        return () => {
            window.removeEventListener(
                SMOOTHIE_LISTS_CHANGED_EVENT,
                handleSmoothieListsChanged,
            );
        };
    });

</script>

<svelte:head>
    <title>{documentTitle}</title>
</svelte:head>

<ViewFrame appShell className="ingredients-page">
    <ViewTop compactHidden={compactTopHidden}>
        <ViewHeader
            title="Ingredients"
            subtitle="Search foods, add them to your fridge, and track shopping needs."
        />

        <IngredientsSearchPanel
            {barcodeLookupBusy}
            filtersActive={activeSheet === "filters"}
            onOpenSearch={openSearchView}
            onScan={startBarcodeScan}
            onToggleFilters={toggleFilters}
            onOpenManualEntry={openManualEntry}
        />
    </ViewTop>

    <ViewBody>
        <SavedIngredientListLayout
            {activeList}
            fridgeCount={onHandTotalCount}
            shoppingListCount={shoppingListTotalCount}
            listLoading={showListLoadingIndicator}
            {listActionError}
            listLoadingError={listLoadingError || provenanceOptionsError}
        >
            <SavedIngredientList
                {activeList}
                foods={activeVisibleList}
                {provenanceOptions}
                activeRawCount={activeRawList.length}
                {listLoading}
                {loadingMoreList}
                canRevealMore={canRevealMoreActiveItems}
                selectedFoodId={selectedFood?.fdcId ?? null}
                selectedIds={selectedActiveItemIds}
				{selectionMode}
                {removingItem}
                {movingItem}
                moving={movingItem !== null}
                revealPaused={ingredientOverlayOpen}
                resetKey={listViewResetKey}
                onSelectAll={selectAllActiveItems}
				onEnterSelection={enterSelectionMode}
				onCancelSelection={cancelSelectionMode}
                onMoveSelection={moveSelectedItems}
                onMoveItem={(food) => moveFoodBetweenLists(activeList, food)}
                onToggle={(foodId) => toggleBulkSelection(activeList, foodId)}
                onPreview={(food) => handleSelect(food, activeList)}
                onActions={(food) => openActionSheet(activeList, food)}
                onRemove={(foodId) => removeFromList(activeList, foodId)}
                onRevealMore={revealMoreActiveItems}
                onScrollDirectionChange={handleListScrollDirectionChange}
            />
        </SavedIngredientListLayout>
    </ViewBody>
</ViewFrame>

<IngredientsFloatingAddButton onClick={openManualEntry} />

<IngredientRoutePopins
    {activeSheet}
    {actionSheetItem}
    {barcodeLookupBusy}
    {listLoading}
    listMembership={selectedFoodListMembership}
    {imagePlacementItem}
    listQuery={listQuery}
    listSort={listSort}
    {removingItem}
    {renameBusy}
    {renameError}
    {renamingItem}
    {scanSignal}
    {searchAddFoodId}
    {savedFoodIdentityKeys}
    {searchViewOpen}
    {provenanceOptions}
    {selectedFood}
    {selectedFoodShowListActions}
    sortOptions={FOOD_LIST_SORT_OPTIONS}
    {canAdjustImagePlacement}
    onAddSearchResult={addSearchResultToFridge}
    onApplyFilters={applyListFilters}
    onCloseActionSheet={closeActionSheet}
    onCloseImagePlacement={closeImagePlacementSheet}
    onCloseIngredientSheet={closeIngredientSheet}
    onCloseNutrition={closeNutritionDetail}
    onCloseRename={closeRenameDialog}
    onCloseSearch={closeSearchView}
    onCloseBarcodeScanner={closeBarcodeScanner}
    onCreateManualIngredient={handleCreate}
    onFilterFromSearch={toggleFilters}
    onLookupStateChange={(busy) => (barcodeLookupBusy = busy)}
    onAdjustImagePlacementFromActionSheet={openImagePlacementFromActionSheet}
    onRemoveFromActionSheet={removeFromActionSheet}
    onRenameFromActionSheet={renameFromActionSheet}
	onSelectFromActionSheet={selectFromActionSheet}
    onRenameListItem={renameListItem}
    onRenameValueChange={() => (renameError = "")}
    onScan={startBarcodeScan}
    onSearchSelect={handleSearchSelect}
    onImagePlacementSave={handleImagePlacementSave}
/>
