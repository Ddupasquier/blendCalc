<script lang="ts">
    import IngredientSearch from "$lib/components/ingredients/IngredientSearch.svelte";
    import CustomIngredientForm from "$lib/components/ingredients/CustomIngredientForm.svelte";
    import NutritionPanel from "$lib/components/ingredients/NutritionPanel.svelte";
    import ListControls from "$lib/components/common/ListControls.svelte";
    import Pagination from "$lib/components/common/Pagination.svelte";
    import PillRow from "$lib/components/common/PillRow.svelte";
    import { LIST_PAGE_SIZES } from "../../defaults/listDefaults";
    import type { FdcFood } from "$lib/utils/food/types";
    import {
        clampPage,
        filterItemsByQuery,
        paginateItems,
    } from "$lib/utils/list/listNavigation";
    import {
        cacheCustomFoodsLocally,
        readCustomFoods,
    } from "$lib/utils/food/customFoods";
    import {
        cacheSmoothieListLocally,
        readSmoothieList,
        removeFoodFromSmoothieList,
        SMOOTHIE_LISTS_CHANGED_EVENT,
        type SmoothieListKey,
    } from "$lib/utils/storage/smoothieLists";
    import {
        reconcileCloudCustomFoods,
        reconcileCloudSmoothieList,
    } from "$lib/utils/storage/supabaseData";
    import { onMount } from "svelte";
    import { MIX_STORAGE_KEYS } from "../../defaults/mixDefaults";

    let onHand = $state<FdcFood[]>([]);
    let shoppingList = $state<FdcFood[]>([]);
    let selectedFood = $state<FdcFood | null>(null);
    let listQuery = $state("");
    let sourceFilter = $state("all");
    let onHandPage = $state(1);
    let shoppingPage = $state(1);

    const sourceFilterOptions = [
        { value: "all", label: "All sources" },
        { value: "custom", label: "Custom only" },
        { value: "fdc", label: "USDA only" },
    ];

    const filterFoods = (foods: FdcFood[]) => {
        return filterItemsByQuery(
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

    const handleSelect = (food: FdcFood) => {
        selectedFood = food;
    };

    const removeFromList = (key: SmoothieListKey, foodId: number) => {
        removeFoodFromSmoothieList(key, foodId);
        if (selectedFood?.fdcId === foodId) {
            selectedFood = null;
        }
        loadLists();
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
            <h3 id="ingredient-search-title">Find Ingredients</h3>
            <p>Pick a result to preview nutrition and add it to a list.</p>
        </div>
        <IngredientSearch onSelect={handleSelect} />
        <CustomIngredientForm onCreate={handleSelect} />
        {#if selectedFood}
            <div class="nutrition-preview">
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
        </div>
    {/if}

    <div class="ingredient-lists-grid">
        <section class="fridge-section">
            <h3>On Hand <span>{filteredOnHand.length}</span></h3>
            <div class="fridge-container" aria-label="On Hand ingredients">
                {#if pagedOnHand.length > 0}
                    <PillRow
                        pills={pagedOnHand.map((item) => item.description)}
                        activeIndices={getActiveIndices(pagedOnHand)}
                        customIndices={pagedOnHand
                            .map((food, i) => (food.customFood ? i : -1))
                            .filter((i) => i !== -1)}
                        onSelect={(idx) => handleSelect(pagedOnHand[idx])}
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
                {:else if onHand.length > 0}
                    <p class="placeholder">No On Hand ingredients match these filters.</p>
                {:else}
                    <p class="placeholder">No ingredients on hand yet.</p>
                {/if}
            </div>
        </section>

        <section class="fridge-section">
            <h3>Shopping List <span>{filteredShoppingList.length}</span></h3>
            <div class="fridge-container" aria-label="Shopping List ingredients">
                {#if pagedShoppingList.length > 0}
                    <PillRow
                        pills={pagedShoppingList.map((item) => item.description)}
                        activeIndices={getActiveIndices(pagedShoppingList)}
                        customIndices={pagedShoppingList
                            .map((food, i) => (food.customFood ? i : -1))
                            .filter((i) => i !== -1)}
                        onSelect={(idx) => handleSelect(pagedShoppingList[idx])}
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
                {:else if shoppingList.length > 0}
                    <p class="placeholder">No shopping-list ingredients match these filters.</p>
                {:else}
                    <p class="placeholder">No items in shopping list yet.</p>
                {/if}
            </div>
        </section>
    </div>
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
        gap: $app-gap-md;
        padding: $app-gap-sm;
        margin-bottom: $app-gap-md;
        background: $app-section-bg;
        border: $app-border;
        border-radius: $app-card-radius;
        box-shadow: $app-box-shadow;
    }

    .section-heading {
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
    }

    .ingredient-lists-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: $app-gap-md;
    }

    .ingredient-list-controls {
        margin-bottom: $app-gap-md;
    }

    .fridge-section {
        margin-bottom: $app-gap-lg;

        h3 {
            display: flex;
            align-items: center;
            gap: $app-gap-xs;
            margin-bottom: $app-gap-sm;
            color: $app-primary;
            font-size: $app-font-size-lg;
            font-weight: 800;

            span {
                padding: 0.08rem 0.4rem;
                color: $app-muted;
                background: $app-accent;
                border-radius: $app-radius-pill;
                font-size: $app-font-size-xs;
            }
        }

        .fridge-container {
            background: $app-bg;
            border-radius: $app-card-radius;
            padding: $app-gap-sm;
            min-height: 48px;
            margin-bottom: $app-gap-sm;
            box-shadow: $app-card-shadow;
            display: block;

            :global(.pill-row) {
                margin-top: 0;
            }
        }

        .placeholder {
            color: $app-muted;
            font-size: $app-font-size-sm;
            margin: 0.2rem 0;
        }
    }

    @media (max-width: $app-breakpoint-lg) {
        .ingredients-page {
            padding-top: $app-gap-sm;
        }

        .ingredient-lists-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
