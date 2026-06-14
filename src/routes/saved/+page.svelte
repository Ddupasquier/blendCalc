<script lang="ts">
    import { goto } from "$app/navigation";
    import {
        cacheSavedDrinksLocally,
        deleteSavedDrink,
        readSavedDrinks,
        restoreSavedDrinkToMix,
        SAVED_DRINKS_CHANGED_EVENT,
        type SavedDrink,
    } from "$lib/utils/storage/savedDrinks";
    import { reconcileCloudSavedDrinks } from "$lib/utils/storage/supabaseData";
    import { onMount } from "svelte";

    let drinks = $state<SavedDrink[]>([]);

    const loadSavedDrinks = async () => {
        const localDrinks = readSavedDrinks();
        drinks = localDrinks;

        const nextDrinks = await reconcileCloudSavedDrinks(localDrinks);
        drinks = nextDrinks;
        cacheSavedDrinksLocally(nextDrinks);
    };

    const formatDate = (timestamp: number) => {
        return new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
        }).format(new Date(timestamp));
    };

    const loadDrink = (drink: SavedDrink) => {
        restoreSavedDrinkToMix(drink);
        goto("/mix");
    };

    const removeDrink = (drinkId: string) => {
        deleteSavedDrink(drinkId);
        loadSavedDrinks();
    };

    onMount(() => {
        loadSavedDrinks();
        window.addEventListener("storage", loadSavedDrinks);
        window.addEventListener(SAVED_DRINKS_CHANGED_EVENT, loadSavedDrinks);
        return () => {
            window.removeEventListener("storage", loadSavedDrinks);
            window.removeEventListener(
                SAVED_DRINKS_CHANGED_EVENT,
                loadSavedDrinks,
            );
        };
    });
</script>

<div class="saved-page">
    <header class="saved-header">
        <h2>Saved Drinks</h2>
        <p>Load a saved smoothie back into Mix when you want to make it again.</p>
    </header>

    {#if drinks.length > 0}
        <div class="saved-grid">
            {#each drinks as drink}
                <article class="saved-card">
                    <div>
                        <h3>{drink.name}</h3>
                        <p>{formatDate(drink.createdAt)}</p>
                    </div>
                    <div class="saved-card__details">
                        <span class="saved-card__count">
                            {drink.foods.length} ingredients
                        </span>
                        {#if drink.foods.length > 0}
                            <div
                                class="saved-card__ingredients"
                                aria-label={`${drink.name} ingredients`}
                            >
                                {#each drink.foods as food, index (`${food.fdcId}-${index}`)}
                                    <span
                                        class="saved-card__ingredient-pill"
                                        class:saved-card__ingredient-pill--custom={food.customFood}
                                    >
                                        {food.description}
                                    </span>
                                {/each}
                            </div>
                        {:else}
                            <p>No ingredients saved with this drink.</p>
                        {/if}
                    </div>
                    <div class="saved-card__actions">
                        <button type="button" onclick={() => loadDrink(drink)}>
                            Load
                        </button>
                        <button
                            class="saved-card__delete"
                            type="button"
                            onclick={() => removeDrink(drink.id)}
                        >
                            Delete
                        </button>
                    </div>
                </article>
            {/each}
        </div>
    {:else}
        <section class="saved-empty">
            <h3>No saved drinks yet.</h3>
            <p>Build a smoothie in Mix, then use Save to name it for later.</p>
            <button type="button" onclick={() => goto("/mix")}>Go to Mix</button>
        </section>
    {/if}
</div>

<style lang="scss">
    @use "../../styles/variables" as *;

    .saved-page {
        max-width: $app-max-width;
        margin: 0 auto;
        padding: $app-gap-sm 0;
        box-sizing: border-box;
    }

    .saved-header {
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

    .saved-grid {
        display: grid;
        gap: $app-gap-sm;
    }

    .saved-card,
    .saved-empty {
        padding: $app-gap-sm;
        background: $app-section-bg;
        border: $app-border;
        border-radius: $app-card-radius;
        box-shadow: $app-box-shadow;
    }

    .saved-card {
        display: grid;
        gap: $app-gap-sm;

        h3 {
            color: $app-primary;
            font-size: $app-font-size-lg;
            font-weight: 800;
        }

        p {
            color: $app-muted;
            font-size: $app-font-size-sm;
        }
    }

    .saved-card__details {
        display: grid;
        gap: 0.2rem;

        .saved-card__count {
            width: fit-content;
            padding: 0.16rem 0.48rem;
            color: $app-primary;
            background: $app-accent;
            border: 1px solid $app-accent;
            border-radius: $app-radius-pill;
            font-size: $app-font-size-xs;
            font-weight: 800;
        }
    }

    .saved-card__ingredients {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3rem;
        max-height: 7.5rem;
        overflow-y: auto;
        padding: 0.1rem 0.1rem 0.15rem 0;
    }

    .saved-card__ingredient-pill {
        max-width: 100%;
        padding: 0.2rem 0.5rem;
        color: $app-primary;
        background: $app-bg;
        border: $app-border;
        border-radius: $app-radius-pill;
        font-size: $app-font-size-sm;
        font-weight: 700;
        line-height: 1.25;
        overflow-wrap: anywhere;
    }

    .saved-card__ingredient-pill--custom {
        background: $app-custom-bg;
        border-color: $app-custom-strong;

        &::after {
            content: "Custom";
            display: inline-block;
            margin-left: 0.35rem;
            padding: 0.04rem 0.32rem;
            color: $app-btn-text;
            background: $app-custom-strong;
            border-radius: $app-radius-pill;
            font-size: $app-font-size-xs;
            font-weight: 900;
            line-height: 1.2;
            text-transform: uppercase;
            letter-spacing: 0.03em;
        }
    }

    .saved-card__actions {
        display: flex;
        gap: $app-gap-sm;
        justify-content: flex-end;

        button {
            padding: 0.4rem 0.8rem;
            color: $app-btn-text;
            background: $app-btn-bg;
            border-radius: $app-radius-pill;
            font-weight: $app-button-font-weight;
            line-height: $app-button-line-height;

            &:hover {
                background: $app-btn-bg-hover;
            }
        }

        .saved-card__delete {
            color: $app-primary;
            background: $app-accent;
        }
    }

    .saved-empty {
        display: grid;
        gap: $app-gap-sm;
        text-align: center;

        h3 {
            color: $app-primary;
        }

        p {
            color: $app-muted;
        }

        button {
            justify-self: center;
            padding: 0.45rem 0.9rem;
            color: $app-btn-text;
            background: $app-btn-bg;
            border-radius: $app-radius-pill;
            font-weight: $app-button-font-weight;
            line-height: $app-button-line-height;
        }
    }
</style>
