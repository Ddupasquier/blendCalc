<script lang="ts">
    import NutritionConfidenceDetails from "$lib/components/ingredients/NutritionConfidenceDetails.svelte";
    import { getFoodQuality } from "$lib/utils/food/foodQuality";
    import type { FdcFood } from "$lib/utils/food/types";
    let { results, onSelect } = $props<{
        results: FdcFood[];
        onSelect: (food: FdcFood) => void;
    }>();
    const formatName = (desc: string): string => {
        return desc.length > 60 ? desc.slice(0, 57) + "…" : desc;
    };
</script>

{#if results.length > 0}
    <ul class="results-list" aria-label="Search results">
        {#each results as food (food.fdcId)}
            {@const quality = getFoodQuality(food)}
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
                </button>
                {#if quality.label === "Partial" || quality.label === "Limited"}
                    <NutritionConfidenceDetails {quality} compact />
                {/if}
            </li>
        {/each}
    </ul>
{/if}

<style lang="scss">
    @use "../../../styles/variables" as *;

    .results-list {
        list-style: none;
        border: $app-border;
        border-radius: $app-radius;
        overflow: hidden;
        box-shadow: $app-card-shadow;
        background: $app-bg;
        max-height: 280px;
        overflow-y: auto;
    }

    .result-item {
        border-bottom: $app-border;
    }

    .result-item:last-child {
        border-bottom: 0;
    }

    .result-btn {
        width: 100%;
        text-align: left;
        background: transparent;
        border-radius: 0;
        padding: 0.55rem 0.7rem;
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        border: 0;
    }

    .result-btn:hover,
    .result-btn:focus-visible {
        background: $app-accent;
        outline: none;
    }

    .result-btn--custom {
        box-shadow: inset 0.28rem 0 0 $app-custom-strong;
    }

    .result-name {
        font-size: $app-font-size-md;
        font-weight: 800;
        color: $app-primary;
    }

    .result-category {
        font-size: $app-font-size-sm;
        font-weight: $app-font-weight-regular;
        color: $app-muted;
    }

    .result-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        margin-top: 0.18rem;
    }

    .result-badge {
        width: fit-content;
        padding: 0.12rem 0.36rem;
        color: $app-primary;
        background: $app-accent;
        border: $app-border;
        border-radius: $app-radius-pill;
        font-size: $app-font-size-xs;
        font-weight: 700;
        line-height: 1.2;
    }

    .result-badge--muted {
        color: $app-muted;
        background: $app-section-bg;
    }

    .result-badge--custom {
        color: $app-btn-text;
        background: $app-custom-strong;
        border-color: $app-custom-strong;
    }
</style>
