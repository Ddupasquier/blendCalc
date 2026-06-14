<script lang="ts">
    import IngredientSearch from "$lib/components/ingredients/IngredientSearch.svelte";
    import CustomIngredientForm from "$lib/components/ingredients/CustomIngredientForm.svelte";
    import NutritionPanel from "$lib/components/ingredients/NutritionPanel.svelte";
    import PillRow from "$lib/components/common/PillRow.svelte";
    import type { FdcFood } from "$lib/utils/food/types";
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

    const removeFromLocalStorageByIndex = (key: SmoothieListKey, idx: number) => {
        const list = readSmoothieList(key);
        const food = list[idx];
        if (!food) return;
        removeFoodFromSmoothieList(key, food.fdcId);
        if (selectedFood?.fdcId === food.fdcId) {
            selectedFood = null;
        }
        loadLists();
    };

    const getActiveIndices = (items: FdcFood[]) => {
        if (!selectedFood) return [];
        const index = items.findIndex((item) => item.fdcId === selectedFood?.fdcId);
        return index === -1 ? [] : [index];
    };

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

    <div class="ingredient-lists-grid">
        <section class="fridge-section">
            <h3>On Hand</h3>
            <div class="fridge-container" aria-label="On Hand ingredients">
                {#if onHand.length > 0}
                    <PillRow
                        pills={onHand.map((item) => item.description)}
                        activeIndices={getActiveIndices(onHand)}
                        customIndices={onHand
                            .map((food, i) => (food.customFood ? i : -1))
                            .filter((i) => i !== -1)}
                        onSelect={(idx) => handleSelect(onHand[idx])}
                        onRemove={(idx) =>
                            removeFromLocalStorageByIndex(
                                MIX_STORAGE_KEYS.fridge,
                                idx,
                            )}
                    />
                {:else}
                    <p class="placeholder">No ingredients on hand yet.</p>
                {/if}
            </div>
        </section>

        <section class="fridge-section">
            <h3>Shopping List</h3>
            <div class="fridge-container" aria-label="Shopping List ingredients">
                {#if shoppingList.length > 0}
                    <PillRow
                        pills={shoppingList.map((item) => item.description)}
                        activeIndices={getActiveIndices(shoppingList)}
                        customIndices={shoppingList
                            .map((food, i) => (food.customFood ? i : -1))
                            .filter((i) => i !== -1)}
                        onSelect={(idx) => handleSelect(shoppingList[idx])}
                        onRemove={(idx) =>
                            removeFromLocalStorageByIndex(
                                MIX_STORAGE_KEYS.shoppingList,
                                idx,
                            )}
                    />
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

    .fridge-section {
        margin-bottom: $app-gap-lg;

        h3 {
            margin-bottom: $app-gap-sm;
            color: $app-primary;
            font-size: $app-font-size-lg;
            font-weight: 800;
        }

        .fridge-container {
            background: $app-bg;
            border-radius: $app-card-radius;
            padding: $app-gap-sm;
            min-height: 48px;
            margin-bottom: $app-gap-sm;
            box-shadow: $app-card-shadow;
            display: flex;
            align-items: center;
            flex-wrap: wrap;
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
