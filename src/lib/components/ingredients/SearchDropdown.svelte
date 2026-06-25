<script lang="ts">
    import NutritionConfidenceDetails from "$lib/components/ingredients/NutritionConfidenceDetails.svelte";
    import Pagination from "$lib/components/common/Pagination.svelte";
    import { LIST_PAGE_SIZES } from "../../../defaults/listDefaults";
    import { getFoodQuality } from "$lib/utils/food/foodQuality";
    import type { FdcFood } from "$lib/utils/food/types";
    import { getFoodPreferenceContext } from "$lib/utils/profile/foodPreferenceContext.svelte";
    import { getFoodPreferenceWarnings } from "$lib/utils/profile/foodPreferenceWarnings";
    import {
        clampPage,
        paginateItems,
    } from "$lib/utils/list/listNavigation";
    let { results, onSelect } = $props<{
        results: FdcFood[];
        onSelect: (food: FdcFood) => void;
    }>();
    let page = $state(1);
    const foodPreferenceContext = getFoodPreferenceContext();
    const pagedResults = $derived<FdcFood[]>(
        paginateItems<FdcFood>(results, page, LIST_PAGE_SIZES.foodSearch),
    );

    const formatName = (desc: string): string => {
        return desc.length > 60 ? desc.slice(0, 57) + "…" : desc;
    };

    $effect(() => {
        page = clampPage(page, results.length, LIST_PAGE_SIZES.foodSearch);
    });

    $effect(() => {
        results;
        page = 1;
    });
</script>

{#if results.length > 0}
    <div class="results-panel">
        <p class="results-summary">{results.length} matches</p>
        <ul class="results-list" aria-label="Search results">
            {#each pagedResults as food (food.fdcId)}
                {@const quality = getFoodQuality(food)}
                {@const preferenceWarnings = food.preferenceWarnings ?? getFoodPreferenceWarnings(food, foodPreferenceContext.current)}
                <li class="result-item">
                    <button
                        class="result-btn"
                        class:result-btn--custom={food.customFood}
                        onclick={() => onSelect(food)}
                    >
                        <span class="result-name"
                            >{formatName(food.description)}</span
                        >
                        {#if food.foodCategory}
                            <span class="result-category">{food.foodCategory}</span>
                        {/if}
                        <span class="result-badges" aria-label={quality.title}>
                            <span class="result-badge" title={quality.title}>
                                {quality.symbol} {quality.label}
                            </span>
                            {#if food.dataType}
                                <span
                                    class="result-badge"
                                    class:result-badge--custom={food.customFood}
                                    class:result-badge--muted={!food.customFood}
                                >
                                    {food.dataType}
                                </span>
                            {/if}
                            {#if food.servingSize && food.servingSizeUnit}
                                <span class="result-badge result-badge--muted">
                                    ↔ {food.servingSize} {food.servingSizeUnit}
                                </span>
                            {/if}
                        </span>
                        {#if preferenceWarnings.length > 0}
                            <span
                                class="result-warning"
                                class:result-warning--potential={!preferenceWarnings.some((warning) => warning.level === "warning")}
                            >
                                {preferenceWarnings.some((warning) => warning.level === "warning") ? "⚠" : "?"}
                                {preferenceWarnings.map((warning) => warning.reason).join(" ")}
                            </span>
                        {/if}
                    </button>
                    {#if quality.label === "Partial" || quality.label === "Limited"}
                        <NutritionConfidenceDetails {quality} compact />
                    {/if}
                </li>
            {/each}
        </ul>
        <Pagination
            {page}
            pageSize={LIST_PAGE_SIZES.foodSearch}
            totalItems={results.length}
            onPageChange={(nextPage) => (page = nextPage)}
            label="Food search results"
        />
    </div>
{/if}

<style lang="scss">
    @use "../../../styles/variables" as *;

    .results-panel {
        min-width: 0;
    }

    .results-summary {
        margin-bottom: $app-gap-xs;
        color: $color-figma-muted;
        font-size: $app-font-size-sm;
        font-weight: $app-font-weight-semibold;
    }

    .results-list {
        display: grid;
        gap: $app-gap-sm;
        max-height: $app-rebuild-search-results-max-height;
        overflow-y: auto;
        list-style: none;
    }

    .result-item {
        min-width: 0;
    }

    .result-btn {
        display: grid;
        width: 100%;
        min-width: 0;
        padding: $app-rebuild-search-result-padding-y $app-rebuild-search-result-padding-x;
        text-align: left;
        background: $color-figma-card;
        border: 1px solid transparent;
        border-radius: $app-rebuild-radius;
        gap: calc($app-gap-xs / 3);
        transition:
            border-color 0.16s ease,
            background-color 0.16s ease,
            transform 0.16s ease;
    }

    .result-btn:hover,
    .result-btn:focus-visible {
        background: color-mix(in srgb, $color-figma-green-soft 48%, $color-figma-card);
        border-color: color-mix(in srgb, $color-figma-green 45%, transparent);
        outline: none;
    }

    .result-name {
        overflow: hidden;
        min-width: 0;
        color: $color-figma-ink;
        font-family: $app-font-family-display;
        font-size: $app-font-size-md;
        font-weight: $app-font-weight-bold;
        line-height: 1.18;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .result-category {
        overflow: hidden;
        color: $color-figma-muted;
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
        margin-top: calc($app-gap-xs / 1.6);
    }

    .result-badge {
        width: fit-content;
        padding: $app-rebuild-badge-padding-y $app-rebuild-badge-padding-x;
        color: color-mix(in srgb, $color-figma-sky 86%, $color-figma-ink);
        background: color-mix(in srgb, $color-figma-sky 18%, $color-figma-card);
        border: 0;
        border-radius: $app-radius-pill;
        font-size: $app-font-size-xs;
        font-weight: $app-font-weight-bold;
        line-height: 1.2;
        text-transform: uppercase;
    }

    .result-badge--muted {
        color: $color-figma-muted;
        background: $color-figma-canvas;
        text-transform: none;
    }

    .result-badge--custom {
        color: $app-btn-text;
        background: $app-custom-strong;
        border-color: $app-custom-strong;
    }

    .result-warning {
        display: block;
        margin-top: calc($app-gap-xs / 2);
        color: $app-warning-strong;
        font-size: $app-font-size-xs;
        font-weight: $app-font-weight-semibold;
        line-height: 1.35;
    }

    .result-warning--potential {
        color: $color-figma-muted;
    }
</style>
