<script lang="ts">
    import PaginatedListControls from "$lib/components/common/navigation/PaginatedListControls/PaginatedListControls.svelte";
    import FoodSymbol from "$lib/assets/icons/FoodSymbol/FoodSymbol.svelte";
    import IngredientProvenanceBadges from "$lib/components/ingredients/provenance/IngredientProvenanceBadges/IngredientProvenanceBadges.svelte";
    import { getFoodPreferenceContext } from "$lib/utils/profile/foodPreferenceContext.svelte";
    import {
        getFoodDisplayCategory,
        getPrimaryFoodWarning,
    } from "$lib/utils/ingredients/ingredientListUi";
    import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import CardWarningEdge from "$lib/components/common/display/CardWarningEdge/CardWarningEdge.svelte";
	import CircularMediaFrame from "$lib/components/common/images/CircularMediaFrame/CircularMediaFrame.svelte";
    import Chevron from "$lib/assets/icons/Chevron/Chevron.svelte";
    import Plus from "$lib/assets/icons/Plus/Plus.svelte";
    import { getFoodIdentityKey } from "$lib/utils/food/records/foodIdentity";
    import { isPrivateCustomFood } from "$lib/utils/food/records/foodClassification";
    import type { SearchDropdownProps } from "./types";

    let {
        results,
        activeResultIndex = -1,
        addingFoodId = null,
        hasMoreResults = false,
        loadingMore = false,
        contentVersion = 0,
        savedFoodIdentityKeys = new Set<string>(),
        provenanceOptions = [],
        onSelect,
        onAdd = () => {},
        onActivate = () => {},
        onLoadMore = () => {},
    }: SearchDropdownProps = $props();
    const foodPreferenceContext = getFoodPreferenceContext();
    let resultsPanelElement = $state<HTMLDivElement | null>(null);

    const formatName = (desc: string): string => {
        return desc.length > 60 ? desc.slice(0, 57) + "…" : desc;
    };

    const requestMoreResults = () => {
        if (!hasMoreResults || loadingMore) return;
        void onLoadMore();
    };

</script>

{#if results.length > 0}
    <div
        bind:this={resultsPanelElement}
        class="results-panel"
    >
        <p class="results-summary sr-only" aria-live="polite">
            {results.length} results loaded
        </p>
        <div
            id="ingredient-search-results"
            class="results-list"
            role="grid"
            aria-label="Search results"
            aria-busy={loadingMore}
        >
            {#each results as food, index (food.fdcId)}
                {@const primaryWarning = getPrimaryFoodWarning(food, foodPreferenceContext.current)}
                {@const isAdding = addingFoodId === food.fdcId}
                {@const isSaved = savedFoodIdentityKeys.has(getFoodIdentityKey(food))}
                <div
                    id={`ingredient-search-result-${food.fdcId}`}
                    class="result-item result-card"
                    class:result-card--active={activeResultIndex === index}
                    class:result-card--custom={isPrivateCustomFood(food)}
                    class:result-card--saved={isSaved}
                    role="row"
                    tabindex="-1"
                    aria-label={`${food.description}, ${getFoodDisplayCategory(food)}${isSaved ? ", already in Fridge or Shopping List" : ""}${primaryWarning ? `, warning: ${primaryWarning}` : ""}`}
                    aria-selected={activeResultIndex === index}
                    onmouseenter={() => onActivate(index)}
                >
					{#if primaryWarning}
						<CardWarningEdge />
					{/if}
                        <span class="result-main-cell" role="gridcell">
                            <button
                                class="result-main"
                                type="button"
                                aria-label={`View nutrition for ${food.description}${isSaved ? ", already in Fridge or Shopping List" : ""}${primaryWarning ? `. Warning: ${primaryWarning}` : ""}`}
                                onfocus={() => onActivate(index)}
                                onclick={() => onSelect(food)}
                            >
                                <CircularMediaFrame class="result-icon">
                                    <FoodSymbol {food} />
								</CircularMediaFrame>
								<span class="result-copy">
									<span class="result-title-row">
										<span class="result-name">{formatName(food.description)}</span>
										<IngredientProvenanceBadges
											{food}
											{provenanceOptions}
											variant="search-card"
										/>
									</span>
									<span class="result-category">{getFoodDisplayCategory(food)}</span>
								</span>
                            </button>
                        </span>
                        {#if !isSaved}
                            <span class="result-add-cell" role="gridcell">
                                <CircleIconButton
                                    class="result-add"
                                    label={`Add ${food.description} to fridge`}
                                    busy={isAdding}
                                    disabled={isAdding}
                                    variant="primary"
                                    size="small"
                                    onfocus={() => onActivate(index)}
                                    onclick={() => onAdd(food)}
                                >
                                    <Plus size={17} strokeWidth={2.9} />
                                </CircleIconButton>
                            </span>
                        {/if}
                        <span class="result-open" role="gridcell" aria-hidden="true">
                            <Chevron class="result-chevron" direction="right" />
                        </span>
                </div>
            {/each}
            <PaginatedListControls
                scrollContainer={resultsPanelElement}
                hasMoreItems={hasMoreResults}
                {loadingMore}
                {contentVersion}
                containerElement="div"
                onLoadMore={requestMoreResults}
            />
        </div>
    </div>
{/if}

<style lang="scss">
	@use "./SearchDropdown.scss";
</style>
