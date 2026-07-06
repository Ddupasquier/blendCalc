<script lang="ts">
    import FoodSymbol from "$lib/assets/icons/FoodSymbol.svelte";
    import WarningTriangle from "$lib/assets/icons/WarningTriangle.svelte";
    import { getFoodQuality } from "$lib/utils/food/quality/foodQuality";
    import type { FdcFood } from "$lib/utils/food/types";
    import { getFoodPreferenceContext } from "$lib/utils/profile/foodPreferenceContext.svelte";
    import {
        getFoodDisplayCategory,
        getFoodSourceLabel,
        getPrimaryFoodWarning,
    } from "$lib/utils/ingredients/ingredientListUi";
    import CircleIconButton from "$lib/components/common/buttons/CircleIconButton.svelte";
    import ChevronRight from "$lib/assets/icons/ChevronRight.svelte";
    import Plus from "$lib/assets/icons/Plus.svelte";

    let {
        results,
        activeResultIndex = -1,
        addingFoodId = null,
        onSelect,
        onAdd = () => {},
        onActivate = () => {},
    } = $props<{
        results: FdcFood[];
        activeResultIndex?: number;
        addingFoodId?: number | null;
        onSelect: (food: FdcFood) => void;
        onAdd?: (food: FdcFood) => void | Promise<void>;
        onActivate?: (index: number) => void;
    }>();
    const foodPreferenceContext = getFoodPreferenceContext();

    const formatName = (desc: string): string => {
        return desc.length > 60 ? desc.slice(0, 57) + "…" : desc;
    };
</script>

{#if results.length > 0}
    <div class="results-panel">
        <p class="results-summary" aria-live="polite">{results.length} matches</p>
        <ul
            id="ingredient-search-results"
            class="results-list"
            role="listbox"
            aria-label="Search results"
        >
            {#each results as food, index (food.fdcId)}
                {@const quality = getFoodQuality(food)}
                {@const primaryWarning = getPrimaryFoodWarning(food, foodPreferenceContext.current)}
                {@const isAdding = addingFoodId === food.fdcId}
                <li class="result-item" role="presentation">
                    <article
                        class="result-card"
                        class:result-card--active={activeResultIndex === index}
                        class:result-card--custom={food.customFood}
                        class:result-card--warning={primaryWarning}
                        onmouseenter={() => onActivate(index)}
                    >
                        <button
                            id={`ingredient-search-result-${food.fdcId}`}
                            class="result-main"
                            type="button"
                            role="option"
                            aria-selected={activeResultIndex === index}
                            aria-label={`View nutrition for ${food.description}`}
                            onfocus={() => onActivate(index)}
                            onclick={() => onSelect(food)}
                        >
                            <span class="result-icon">
                                <FoodSymbol {food} />
                            </span>
                            <span class="result-copy">
                                <span class="result-name">{formatName(food.description)}</span>
                                <span class="result-category">{getFoodDisplayCategory(food)}</span>
                                <span class="result-badges" aria-label={quality.title}>
                                    <span
                                        class="result-badge"
                                        class:result-badge--custom={food.customFood}
                                    >
                                        {getFoodSourceLabel(food)}
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
                        <CircleIconButton
                            class="result-open"
                            label={`View nutrition for ${food.description}`}
                            variant="ghost"
                            size="small"
                            onfocus={() => onActivate(index)}
                            onclick={() => onSelect(food)}
                        >
                            <ChevronRight class="result-chevron" size={18} />
                        </CircleIconButton>
                    </article>
                </li>
            {/each}
        </ul>
    </div>
{/if}

<style lang="scss">
    @use "../../../../styles/variables" as *;

    .results-panel {
        min-width: 0;
        margin-top: $app-gap-sm;
    }

    .results-summary {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }

    .results-list {
        display: grid;
        gap: $app-vertical-stack-gap;
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
            border-color 0.16s ease,
            background-color 0.16s ease,
            transform 0.16s ease;
    }

    .result-card--active,
    .result-card:hover,
    .result-card:focus-within {
        background: color-mix(in srgb, $ingredient-surface-positive 84%, $ingredient-surface-card);
        border-color: color-mix(in srgb, $ingredient-accent-primary 86%, $ingredient-text-primary);
    }

    .result-card--active {
        outline: 0.12rem solid color-mix(in srgb, $ingredient-accent-primary 34%, transparent);
        outline-offset: 0.12rem;
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

        &:focus-visible {
            outline: none;
        }
    }

    .result-icon {
        display: inline-grid;
        place-items: center;
        width: 2.7rem;
        height: 2.7rem;
        flex: 0 0 auto;
        background: color-mix(in srgb, $ingredient-surface-card 74%, transparent);
        border-radius: $ingredient-radius-pill;
        font-size: $app-font-size-xl;
        line-height: 1;
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
