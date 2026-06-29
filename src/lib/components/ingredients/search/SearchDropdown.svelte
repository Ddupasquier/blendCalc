<script lang="ts">
    import { getFoodQuality } from "$lib/utils/food/foodQuality";
    import type { FdcFood } from "$lib/utils/food/types";
    import { getFoodPreferenceContext } from "$lib/utils/profile/foodPreferenceContext.svelte";
    import {
        getFoodDisplayCategory,
        getFoodIcon,
        getFoodSourceLabel,
        getPrimaryFoodWarning,
    } from "$lib/utils/ingredients/ingredientListUi";
    import Check from "$lib/assets/icons/Check.svelte";
    import ChevronRight from "$lib/assets/icons/ChevronRight.svelte";

    let {
        results,
        activeResultIndex = -1,
        onSelect,
        onActivate = () => {},
    } = $props<{
        results: FdcFood[];
        activeResultIndex?: number;
        onSelect: (food: FdcFood) => void;
        onActivate?: (index: number) => void;
    }>();
    const foodPreferenceContext = getFoodPreferenceContext();

    const formatName = (desc: string): string => {
        return desc.length > 60 ? desc.slice(0, 57) + "…" : desc;
    };
</script>

{#if results.length > 0}
    <div class="results-panel">
        <p class="results-summary">{results.length} matches</p>
        <ul
            id="ingredient-search-results"
            class="results-list"
            role="listbox"
            aria-label="Search results"
        >
            {#each results as food, index (food.fdcId)}
                {@const quality = getFoodQuality(food)}
                {@const primaryWarning = getPrimaryFoodWarning(food, foodPreferenceContext.current)}
                <li class="result-item" role="presentation">
                    <button
                        id={`ingredient-search-result-${food.fdcId}`}
                        class="result-btn"
                        class:result-btn--active={activeResultIndex === index}
                        class:result-btn--custom={food.customFood}
                        class:result-btn--warning={primaryWarning}
                        role="option"
                        aria-selected={activeResultIndex === index}
                        onfocus={() => onActivate(index)}
                        onmouseenter={() => onActivate(index)}
                        onclick={() => onSelect(food)}
                    >
                        <span class="result-icon" aria-hidden="true">
                            {getFoodIcon(food)}
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
                                        ⚠ {primaryWarning}
                                    </span>
                                {/if}
                            </span>
                        </span>
                        <span class="result-actions" aria-hidden="true">
                            <span class="result-check">
                                <Check size={16} strokeWidth={2.8} />
                            </span>
                            <ChevronRight class="result-chevron" size={18} />
                        </span>
                    </button>
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
        margin-bottom: $app-gap-xs;
        color: $ingredient-text-muted;
        font-size: $app-font-size-sm;
        font-weight: $app-font-weight-semibold;
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

    .result-btn {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        width: 100%;
        min-width: 0;
        min-height: calc($ingredient-control-height * 1.35);
        padding: $ingredient-card-padding-compact;
        text-align: left;
        background: $ingredient-surface-positive;
        border: 2px solid $ingredient-accent-primary;
        border-radius: $ingredient-radius-card;
        gap: $app-horizontal-control-gap;
        transition:
            border-color 0.16s ease,
            background-color 0.16s ease,
            transform 0.16s ease;
    }

    .result-btn--active,
    .result-btn:hover,
    .result-btn:focus-visible {
        background: color-mix(in srgb, $ingredient-surface-positive 84%, $ingredient-surface-card);
        border-color: color-mix(in srgb, $ingredient-accent-primary 86%, $ingredient-text-primary);
        outline: none;
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
        gap: calc($app-gap-xs / 2);
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
        gap: calc($app-gap-xs / 1.5);
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

    .result-actions {
        display: inline-flex;
        align-items: center;
        gap: $app-gap-sm;
        color: $ingredient-accent-primary;
    }

    .result-check {
        display: inline-grid;
        place-items: center;
        width: 1.65rem;
        height: 1.65rem;
        border-radius: $app-radius-pill;
    }

    :global(.result-chevron) {
        color: $ingredient-text-muted;
    }
</style>
