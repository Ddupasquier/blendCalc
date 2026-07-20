<script lang="ts">
    import { goto } from "$app/navigation";
    import ListControls from "$lib/components/common/lists/ListControls.svelte";
    import Pagination from "$lib/components/common/lists/Pagination.svelte";
	import CustomBadge from "$lib/components/common/display/CustomBadge.svelte";
	import ConfirmationDialog from "$lib/components/common/dialogs/ConfirmationDialog.svelte";
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner.svelte";
    import { LIST_PAGE_SIZES } from "../../defaults/listDefaults";
    import {
        clampPage,
        filterItemsByQuery,
        paginateItems,
    } from "$lib/utils/list/listNavigation";
    import {
        deleteSavedDrink,
        normalizeSavedDrink,
        restoreSavedDrinkToMix,
        SAVED_DRINKS_CHANGED_EVENT,
        type SavedDrink,
    } from "$lib/utils/storage/client/savedDrinks";
    import { readCloudSavedDrinks } from "$lib/utils/storage/supabase";
    import { onMount } from "svelte";

    let drinks = $state<SavedDrink[]>([]);
    let query = $state("");
    let sort = $state("newest");
    let page = $state(1);
	let drinkPendingDelete = $state<SavedDrink | null>(null);
	let deletingDrinkId = $state<string | null>(null);
	let loadingDrinkId = $state<string | null>(null);
    let deleteError = $state("");
	let loadError = $state("");
	let loadingDrinks = $state(true);

    const sortOptions = [
        { value: "newest", label: "Newest first" },
        { value: "oldest", label: "Oldest first" },
        { value: "name", label: "Name A–Z" },
    ];

    const filteredDrinks = $derived.by(() => {
        const matchingDrinks = filterItemsByQuery(
            drinks,
            query,
            (drink) =>
                [drink.name, ...drink.foods.map((food) => food.description)].join(
                    " ",
                ),
        );

        return [...matchingDrinks].sort((first, second) => {
            if (sort === "oldest") return first.createdAt - second.createdAt;
            if (sort === "name") return first.name.localeCompare(second.name);
            return second.createdAt - first.createdAt;
        });
    });
    const pagedDrinks = $derived(
        paginateItems(
            filteredDrinks,
            page,
            LIST_PAGE_SIZES.savedDrinks,
        ),
    );

    const loadSavedDrinks = async () => {
		loadingDrinks = true;
		try {
			loadError = "";
			const nextDrinks = await readCloudSavedDrinks();
			if (!nextDrinks) throw new Error("Saved drinks are unavailable.");
			drinks = nextDrinks.map(normalizeSavedDrink);
		} catch {
			drinks = [];
			loadError = "Your saved drinks could not be loaded. Try again.";
		} finally {
			loadingDrinks = false;
		}
    };

    const formatDate = (timestamp: number) => {
        return new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
        }).format(new Date(timestamp));
    };

    const loadDrink = async (drink: SavedDrink) => {
		if (loadingDrinkId || deletingDrinkId) return;
		loadError = "";
		loadingDrinkId = drink.id;

		try {
			const restored = await restoreSavedDrinkToMix(drink);
			if (!restored) {
				loadError =
					"This drink could not be loaded because its missing ingredients could not be added to your shopping list.";
				return;
			}
			await goto("/mix");
		} finally {
			loadingDrinkId = null;
		}
    };

    const removeDrink = async () => {
		if (!drinkPendingDelete || deletingDrinkId) return;

		deletingDrinkId = drinkPendingDelete.id;
		deleteError = "";
		try {
			const deleted = await deleteSavedDrink(drinkPendingDelete.id);
			if (!deleted) {
				deleteError = "That drink could not be deleted. Try again.";
				return;
			}
			drinkPendingDelete = null;
			await loadSavedDrinks();
		} finally {
			deletingDrinkId = null;
		}
    };

    const updateQuery = (value: string) => {
        query = value;
        page = 1;
    };

    const updateSort = (value: string) => {
        sort = value;
        page = 1;
    };

    $effect(() => {
        page = clampPage(
            page,
            filteredDrinks.length,
            LIST_PAGE_SIZES.savedDrinks,
        );
    });

    onMount(() => {
		void loadSavedDrinks();
        window.addEventListener(SAVED_DRINKS_CHANGED_EVENT, loadSavedDrinks);
        return () => {
            window.removeEventListener(
                SAVED_DRINKS_CHANGED_EVENT,
                loadSavedDrinks,
            );
        };
    });
</script>

<div class="saved-page">
	<ConfirmationDialog
		open={drinkPendingDelete !== null}
		title="Delete saved drink?"
		description={drinkPendingDelete
			? `Delete “${drinkPendingDelete.name}”? This cannot be undone.`
			: "Delete this saved drink?"}
		confirmLabel="Delete"
		busy={deletingDrinkId !== null}
		danger
		onConfirm={() => void removeDrink()}
		onCancel={() => {
			if (!deletingDrinkId) drinkPendingDelete = null;
		}}
	/>
    <header class="saved-header">
        <h2>Saved Drinks</h2>
        <p>Load a saved smoothie back into Mix when you want to make it again.</p>
    </header>
	{#if deleteError}
		<p class="saved-action-error" role="alert">{deleteError}</p>
	{/if}
	{#if loadError}
		<p class="saved-action-error" role="alert">{loadError}</p>
	{/if}

    {#if loadingDrinks && drinks.length === 0}
		<section class="saved-empty" aria-busy="true">
			<LoadingSpinner label="Loading saved drinks" showLabel />
		</section>
    {:else if drinks.length > 0}
        <ListControls
            id="saved-drinks-search"
            {query}
            onQueryChange={updateQuery}
            placeholder="Search drink names or ingredients…"
            label="Find saved drinks"
            totalCount={drinks.length}
            visibleCount={filteredDrinks.length}
            itemLabel="drinks"
            filterLabel="Sort"
            filterValue={sort}
            filterOptions={sortOptions}
            onFilterChange={updateSort}
        />

        {#if pagedDrinks.length > 0}
        <div class="saved-grid">
            {#each pagedDrinks as drink (drink.id)}
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
                                        <span class="saved-card__ingredient-name" title={food.description}>
                                            {food.description}
                                        </span>
                                        {#if food.customFood}
                                            <CustomBadge />
                                        {/if}
                                    </span>
                                {/each}
                            </div>
                        {:else}
                            <p>No ingredients saved with this drink.</p>
                        {/if}
                    </div>
                    <div class="saved-card__actions">
                        <button
							type="button"
							disabled={loadingDrinkId !== null || deletingDrinkId !== null}
							onclick={() => void loadDrink(drink)}
						>
							{#if loadingDrinkId === drink.id}<LoadingSpinner size="small" decorative />{/if}
							Load
                        </button>
                        <button
                            class="saved-card__delete"
                            type="button"
							disabled={deletingDrinkId !== null || loadingDrinkId !== null}
							onclick={() => {
								deleteError = "";
								drinkPendingDelete = drink;
							}}
                        >
                            Delete
                        </button>
                    </div>
                </article>
            {/each}
        </div>
        <Pagination
            {page}
            pageSize={LIST_PAGE_SIZES.savedDrinks}
            totalItems={filteredDrinks.length}
            onPageChange={(nextPage) => (page = nextPage)}
            label="Saved drinks"
        />
        {:else}
            <section class="saved-empty saved-empty--filtered">
                <h3>No saved drinks match.</h3>
                <p>Try a different drink name or ingredient.</p>
                <button type="button" onclick={() => updateQuery("")}>Clear search</button>
            </section>
        {/if}
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

	.saved-action-error {
		margin-bottom: $app-gap-sm;
		padding: $app-gap-sm;
		color: $app-warning-strong;
		background: $app-warning-bg;
		border: $app-warning-border;
		border-radius: $app-radius;
		font-size: $app-font-size-sm;
		font-weight: 800;
	}

    .saved-grid {
        display: grid;
        gap: $app-gap-sm;
        margin-top: $app-gap-sm;
    }

    .saved-card,
    .saved-empty {
        padding: $app-gap-sm;
        background: $app-section-bg;
        border: $app-border;
        border-radius: $app-card-radius;
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
        display: inline-grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.28rem;
        max-width: 100%;
        padding: 0.2rem 0.5rem;
        color: $app-primary;
        background: $app-bg;
        border: $app-border;
        border-radius: $app-radius-pill;
        font-size: $app-font-size-sm;
        font-weight: 700;
        line-height: 1.25;
    }

    .saved-card__ingredient-name {
        display: -webkit-box;
        min-width: 0;
        overflow: hidden;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        overflow-wrap: anywhere;
    }

    .saved-card__ingredient-pill--custom {
        background: $app-custom-bg;
        border-color: $app-custom-strong;
    }

    .saved-card__actions {
        display: flex;
        gap: $app-gap-sm;
        justify-content: flex-end;

		button {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: $app-gap-xs;
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

    .saved-empty--filtered {
        margin-top: $app-gap-sm;
    }
</style>
