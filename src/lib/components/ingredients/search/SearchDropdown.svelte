<script lang="ts">
    import PaginatedListControls from "$lib/components/common/navigation/PaginatedListControls.svelte";
    import FoodSymbol from "$lib/assets/icons/FoodSymbol.svelte";
    import WarningTriangle from "$lib/assets/icons/WarningTriangle.svelte";
    import { getFoodQuality } from "$lib/utils/food/quality/foodQuality";
    import { getFoodPreferenceContext } from "$lib/utils/profile/foodPreferenceContext.svelte";
    import {
        getFoodDisplayCategory,
        getPrimaryFoodWarning,
    } from "$lib/utils/ingredients/ingredientListUi";
    import {
        getIngredientSourceBadgeLabel,
    } from "$lib/utils/ingredients/ingredientSourceOptions";
    import CircleIconButton from "$lib/components/common/buttons/CircleIconButton.svelte";
	import CircularMediaFrame from "$lib/components/common/images/CircularMediaFrame.svelte";
    import Chevron from "$lib/assets/icons/Chevron.svelte";
    import Plus from "$lib/assets/icons/Plus.svelte";
    import { getFoodIdentityKey } from "$lib/utils/food/records/foodIdentity";
    import type { SearchDropdownProps } from "$lib/components/ingredients/search/types";

    let {
        results,
        activeResultIndex = -1,
        addingFoodId = null,
        hasMoreResults = false,
        loadingMore = false,
        contentVersion = 0,
        savedFoodIdentityKeys = new Set<string>(),
        sourceOptions = [],
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
                {@const quality = getFoodQuality(food)}
                {@const primaryWarning = getPrimaryFoodWarning(food, foodPreferenceContext.current)}
                {@const isAdding = addingFoodId === food.fdcId}
                {@const isSaved = savedFoodIdentityKeys.has(getFoodIdentityKey(food))}
                <div
                    id={`ingredient-search-result-${food.fdcId}`}
                    class="result-item result-card"
                    class:result-card--active={activeResultIndex === index}
                    class:result-card--custom={food.customFood}
                    class:result-card--warning={primaryWarning}
                    class:result-card--saved={isSaved}
                    role="row"
                    tabindex="-1"
                    aria-label={`${food.description}, ${getFoodDisplayCategory(food)}${isSaved ? ", already in Fridge or Shopping List" : ""}`}
                    aria-selected={activeResultIndex === index}
                    onmouseenter={() => onActivate(index)}
                >
                        <span class="result-main-cell" role="gridcell">
                            <button
                                class="result-main"
                                type="button"
                                aria-label={`View nutrition for ${food.description}${isSaved ? ", already in Fridge or Shopping List" : ""}`}
                                onfocus={() => onActivate(index)}
                                onclick={() => onSelect(food)}
                            >
                                <CircularMediaFrame class="result-icon">
                                    <FoodSymbol {food} />
                                </CircularMediaFrame>
                                <span class="result-copy">
                                    <span class="result-name">{formatName(food.description)}</span>
                                    <span class="result-category">{getFoodDisplayCategory(food)}</span>
                                    <span class="result-badges" aria-label={quality.title}>
                                        <span
                                            class="result-badge"
                                            class:result-badge--custom={food.customFood}
                                        >
                                            {getIngredientSourceBadgeLabel(food, sourceOptions)}
                                        </span>
                                        {#if primaryWarning}
                                            <span class="result-warning">
                                                <WarningTriangle size={10} strokeWidth={2.7} />
                                                {primaryWarning}
                                            </span>
                                        {/if}
                                    </span>
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
                                    {#if isAdding}
                                        …
                                    {:else}
                                        <Plus size={17} strokeWidth={2.9} />
                                    {/if}
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
    @use "../../../../styles/variables" as *;

    .results-panel {
        min-width: 0;
        margin-top: $app-gap-sm;
		overflow-anchor: none;
		overscroll-behavior: contain;
		scrollbar-gutter: stable;
		-webkit-overflow-scrolling: touch;
    }

    .results-list {
        display: grid;
        gap: $app-vertical-stack-gap;
		margin: 0;
		padding: 0 0 $app-vertical-stack-gap;
        overflow: visible;
        list-style: none;
    }

    .result-item {
        min-width: 0;
    }

    .result-card {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        align-items: center;
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        min-height: calc($ingredient-control-height * 1.35);
        padding: $ingredient-card-padding-compact;
        background: $ingredient-surface-positive;
        border: 2px solid $ingredient-accent-primary;
        border-radius: $ingredient-radius-card;
        gap: $app-horizontal-control-gap;
        transition:
            border-color 160ms ease,
            background-color 160ms ease;
    }

    .result-card--active {
        background: $ingredient-surface-card;
        border-color: $ingredient-accent-primary;
    }

    .result-card--saved {
        grid-template-columns: minmax(0, 1fr) auto;
    }

    .result-main {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: center;
        gap: $app-horizontal-control-gap;
        min-width: 0;
        padding: 0;
        color: inherit;
        text-align: left;
        background: transparent;
        border: 0;
        width: 100%;

        &:focus-visible {
            outline: $app-focus-outline;
            outline-offset: $app-focus-outline-offset;
            border-radius: $ingredient-radius-control;
        }
    }

    .result-main-cell {
        min-width: 0;
    }

    .result-add-cell,
    .result-open {
        display: inline-grid;
        place-items: center;
    }

    .result-open {
        width: $ingredient-action-icon-size;
        height: $ingredient-action-icon-size;
        color: $ingredient-text-muted;
		font-size: $ingredient-control-icon-size;
        line-height: 1;
    }

	:global(.result-icon) {
		--circular-media-frame-size: #{$ingredient-search-result-icon-size};
		--circular-media-frame-background: color-mix(in srgb, #{$ingredient-surface-card} 74%, transparent);
		--circular-media-frame-font-size: #{$app-font-size-xl};
	}

    .result-copy {
        display: grid;
        min-width: 0;
        gap: $app-gap-2xs;
    }

    .result-name {
        overflow: hidden;
        min-width: 0;
        color: $ingredient-text-primary;
        font-family: $app-font-family-display;
        font-size: $app-font-size-md;
        font-weight: $app-font-weight-bold;
        line-height: 1.18;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .result-category {
        overflow: hidden;
        color: $ingredient-text-muted;
        font-size: $app-font-size-sm;
        font-weight: $app-font-weight-regular;
        line-height: 1.25;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .result-badges {
        display: flex;
        flex-wrap: wrap;
        gap: $app-gap-inline-compact;
        margin-top: 0;
    }

    .result-badge {
        width: fit-content;
        padding: $ingredient-badge-padding-y $ingredient-badge-padding-x;
        color: color-mix(in srgb, $ingredient-accent-info 86%, $ingredient-text-primary);
        background: color-mix(in srgb, $ingredient-accent-info 18%, $ingredient-surface-card);
        border: 0;
        border-radius: $app-radius-pill;
        font-size: $app-font-size-xs;
        font-weight: $app-font-weight-bold;
        line-height: 1.2;
        text-transform: uppercase;
    }

    .result-badge--custom {
        color: $app-btn-text;
        background: $app-custom-strong;
        border-color: $app-custom-strong;
    }

    .result-warning {
        width: fit-content;
        padding: $ingredient-badge-padding-y $ingredient-badge-padding-x;
        color: $app-warning-strong;
        background: $app-warning-bg;
        border: $app-warning-border;
        border-radius: $app-radius-pill;
        font-size: $app-font-size-xs;
        font-weight: $app-font-weight-bold;
        line-height: 1.2;
    }

    :global(.result-chevron) {
        color: currentColor;
    }
</style>
