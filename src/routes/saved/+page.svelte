<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { flip } from "svelte/animate";
	import { onMount } from "svelte";
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import ListControls from "$lib/components/common/lists/ListControls/ListControls.svelte";
	import ListSortSheet from "$lib/components/common/lists/ListSortSheet/ListSortSheet.svelte";
	import PaginatedListControls from "$lib/components/common/navigation/PaginatedListControls/PaginatedListControls.svelte";
	import ViewBody from "$lib/components/common/view/ViewBody/ViewBody.svelte";
	import ViewFrame from "$lib/components/common/view/ViewFrame/ViewFrame.svelte";
	import ViewHeader from "$lib/components/common/view/ViewHeader/ViewHeader.svelte";
	import ViewTop from "$lib/components/common/view/ViewTop/ViewTop.svelte";
	import SavedRecipeCard from "$lib/components/saved/SavedRecipeCard/SavedRecipeCard.svelte";
	import SavedRecipesEmptyState from "$lib/components/saved/SavedRecipesEmptyState/SavedRecipesEmptyState.svelte";
	import { LIST_PAGE_SIZES } from "$lib/config/listPagination";
	import { getAppDocumentTitle } from "$lib/config/pageMetadata";
	import {
		getMotionSafeDuration,
		MOTION_DURATION_MS,
	} from "$lib/utils/animation/motion";
	import { filterItemsByQuery } from "$lib/utils/list/listNavigation";
	import {
		FOOD_SAFETY_FILTER_OPTIONS,
		FOOD_SAFETY_FILTER_VALUES,
		foodMatchesSafetyFilter,
		isFoodSafetyFilter,
		type FoodSafetyFilter,
	} from "$lib/utils/food/safety/foodSafetyFilters";
	import { createScrollAwareHeaderVisibilityController } from "$lib/utils/navigation/scrollAwareHeaderVisibilityController.svelte";
	import { navigateShallowRoute } from "$lib/utils/navigation/shallowRouteNavigation";
	import {
		getActiveShallowRouteUrl,
		SHALLOW_ROUTE_PAGE_STATE_KEYS,
	} from "$lib/utils/navigation/shallowRouteState";
	import {
		deleteSavedRecipe,
		normalizeSavedRecipe,
		restoreSavedRecipeToMix,
		SAVED_RECIPES_CHANGED_EVENT,
		type SavedRecipe,
	} from "$lib/utils/storage/client/savedRecipes";
	import { readCloudSavedRecipes } from "$lib/utils/storage/supabase";

	const initialSavedData = page.data.savedData;
	let recipes = $state<SavedRecipe[]>(
		(initialSavedData?.recipes ?? []).map(normalizeSavedRecipe),
	);
	let query = $state("");
	let sort = $state("newest");
	let safetyFilter = $state<FoodSafetyFilter>(FOOD_SAFETY_FILTER_VALUES.all);
	let visibleCount = $state<number>(LIST_PAGE_SIZES.savedRecipes);
	let deletingRecipeId = $state<string | null>(null);
	let loadingRecipeId = $state<string | null>(null);
	let deleteError = $state("");
	let loadError = $state(initialSavedData?.loadError ?? "");
	let loadingRecipes = $state(false);
	let scrollContainer = $state<HTMLElement | null>(null);
	const headerVisibility = createScrollAwareHeaderVisibilityController({
		isEnabled: () => !sortSheetOpen,
	});

	const sortOptions = [
		{ value: "newest", label: "Newest first" },
		{ value: "oldest", label: "Oldest first" },
		{ value: "name", label: "Name A–Z" },
	];

	const filteredRecipes = $derived.by(() => {
		const matchingRecipes = filterItemsByQuery(recipes, query, (recipe) =>
			[recipe.name, ...recipe.foods.map((food) => food.description)].join(" "),
		).filter((recipe) =>
			safetyFilter === FOOD_SAFETY_FILTER_VALUES.all
				? true
				: recipe.foods.some((food) =>
						foodMatchesSafetyFilter(food, safetyFilter),
					),
		);

		return [...matchingRecipes].sort((first, second) => {
			if (sort === "oldest") return first.createdAt - second.createdAt;
			if (sort === "name") return first.name.localeCompare(second.name);
			return second.createdAt - first.createdAt;
		});
	});
	const visibleRecipes = $derived(filteredRecipes.slice(0, visibleCount));
	const hasMoreRecipes = $derived(
		visibleRecipes.length < filteredRecipes.length,
	);
	const activeSavedRecipesRouteUrl = $derived(
		getActiveShallowRouteUrl(page.url, page.state.savedRecipesRouteHref),
	);
	const sortSheetOpen = $derived(
		activeSavedRecipesRouteUrl.pathname === "/saved/sort",
	);
	const documentTitle = $derived(
		getAppDocumentTitle(activeSavedRecipesRouteUrl),
	);

	const loadSavedRecipes = async () => {
		loadingRecipes = true;
		try {
			loadError = "";
			const nextRecipes = await readCloudSavedRecipes();
			if (!nextRecipes) throw new Error("Saved recipes are unavailable.");
			recipes = nextRecipes.map(normalizeSavedRecipe);
		} catch {
			recipes = [];
			loadError = "Your saved recipes could not be loaded. Try again.";
		} finally {
			loadingRecipes = false;
		}
	};

	const loadRecipe = async (recipe: SavedRecipe) => {
		if (loadingRecipeId || deletingRecipeId) return;
		loadError = "";
		loadingRecipeId = recipe.id;

		try {
			const restored = await restoreSavedRecipeToMix(recipe);
			if (!restored) {
				loadError =
					"This recipe could not be loaded because its missing ingredients could not be added to your shopping list.";
				return;
			}
			await goto("/mix");
		} catch {
			loadError = "We couldn't open that mix. Please try again.";
		} finally {
			loadingRecipeId = null;
		}
	};

	const removeRecipe = async (recipe: SavedRecipe) => {
		if (deletingRecipeId) return;

		deletingRecipeId = recipe.id;
		deleteError = "";
		try {
			const deleted = await deleteSavedRecipe(recipe.id, {
				notify: false,
			});
			if (!deleted) {
				deleteError = "We couldn't delete that mix. Please try again.";
				return;
			}
			recipes = recipes.filter((savedRecipe) => savedRecipe.id !== recipe.id);
		} catch {
			deleteError = "We couldn't delete that mix. Please try again.";
		} finally {
			deletingRecipeId = null;
		}
	};

	const updateQuery = (value: string) => {
		query = value;
		visibleCount = LIST_PAGE_SIZES.savedRecipes;
		headerVisibility.show(scrollContainer?.scrollTop ?? 0);
	};

	const updateSort = (value: string) => {
		sort = value;
		visibleCount = LIST_PAGE_SIZES.savedRecipes;
		headerVisibility.show(scrollContainer?.scrollTop ?? 0);
	};

	const openSortSheet = () => {
		if (sortSheetOpen) return;
		headerVisibility.show(scrollContainer?.scrollTop ?? 0);
		const href = "/saved/sort";
		navigateShallowRoute({
			href,
			pageState: page.state,
			routeStateKey: SHALLOW_ROUTE_PAGE_STATE_KEYS.savedRecipes,
		});
	};

	const closeSortSheet = () => {
		if (!sortSheetOpen) return;
		const href = "/saved";
		navigateShallowRoute({
			href,
			pageState: page.state,
			routeStateKey: SHALLOW_ROUTE_PAGE_STATE_KEYS.savedRecipes,
			replace: true,
		});
	};

	const applySort = (value: string, nextSafetyFilter?: string) => {
		updateSort(value);
		const requestedSafetyFilter = nextSafetyFilter ?? "";
		safetyFilter = isFoodSafetyFilter(requestedSafetyFilter)
			? requestedSafetyFilter
			: FOOD_SAFETY_FILTER_VALUES.all;
		closeSortSheet();
	};

	const revealMoreRecipes = () => {
		visibleCount += LIST_PAGE_SIZES.savedRecipes;
	};

	const getListReflowDuration = () =>
		getMotionSafeDuration(MOTION_DURATION_MS.reflow);

	onMount(() => {
		window.addEventListener(SAVED_RECIPES_CHANGED_EVENT, loadSavedRecipes);
		return () => {
			window.removeEventListener(SAVED_RECIPES_CHANGED_EVENT, loadSavedRecipes);
		};
	});

	$effect(() => headerVisibility.observe(scrollContainer));
</script>

<svelte:head>
	<title>{documentTitle}</title>
</svelte:head>

<ListSortSheet
	open={sortSheetOpen}
	value={sort}
	options={sortOptions}
	filterValue={safetyFilter}
	filterOptions={FOOD_SAFETY_FILTER_OPTIONS.map((option) => ({
		...option,
		label:
			option.value === FOOD_SAFETY_FILTER_VALUES.all
				? "All recipes"
				: option.value === FOOD_SAFETY_FILTER_VALUES.warnings
					? "Recipes with warnings"
					: "Recipes with active recalls",
	}))}
	title="Filter and sort"
	titleId="saved-sort-sheet-title"
	label="Filter and sort saved recipes"
	onApply={applySort}
	onClose={closeSortSheet}
/>

<ViewFrame appShell className="saved-page">
	<ViewTop
		className="saved-page__top"
		compactHidden={headerVisibility.state.hidden}
	>
		<ViewHeader
			title="Saved Recipes"
			subtitle="Revisit combinations you’ve saved and load them back into Mix whenever you need them."
		/>

		{#if recipes.length > 0}
			<ListControls
				id="saved-recipes-search"
				{query}
				onQueryChange={updateQuery}
				placeholder="Search saved recipes…"
				label="Search saved recipes by name or ingredient"
				totalCount={recipes.length}
				visibleCount={filteredRecipes.length}
				itemLabel="recipes"
				filterLabel="Filter and sort saved recipes"
				filterValue={safetyFilter}
				filterOptions={FOOD_SAFETY_FILTER_OPTIONS}
				filtersActive={sortSheetOpen ||
					safetyFilter !== FOOD_SAFETY_FILTER_VALUES.all}
				filterControlsId="saved-sort-sheet-title"
				onFilterOpen={openSortSheet}
			/>
		{/if}
	</ViewTop>

	<ViewBody>
		<div
			class="saved-page__scroll"
			bind:this={scrollContainer}
			onscroll={headerVisibility.handleScroll}
		>
			<div class="saved-page__content">
				{#if deleteError}
					<StatusMessage tone="danger" message={deleteError} />
				{/if}
				{#if loadError}
					<StatusMessage tone="danger" message={loadError} />
				{/if}

				{#if loadingRecipes && recipes.length === 0}
					<section class="saved-page__loading" aria-busy="true">
						<LoadingSpinner label="Loading saved recipes" showLabel />
					</section>
				{:else if recipes.length > 0}
					{#if visibleRecipes.length > 0}
						<ul class="saved-page__list" aria-label="Saved recipes">
							{#each visibleRecipes as recipe, index (recipe.id)}
								<li
									data-tutorial-target={index === 0
										? "saved-recipe"
										: undefined}
									animate:flip={{ duration: getListReflowDuration() }}
								>
									<SavedRecipeCard
										{recipe}
										loading={loadingRecipeId === recipe.id}
										deleting={deletingRecipeId === recipe.id}
										disabled={loadingRecipeId !== null ||
											deletingRecipeId !== null}
										onLoad={(selectedRecipe) => void loadRecipe(selectedRecipe)}
										onDelete={(selectedRecipe) =>
											void removeRecipe(selectedRecipe)}
									/>
								</li>
							{/each}
						</ul>
						<PaginatedListControls
							{scrollContainer}
							hasMoreItems={hasMoreRecipes}
							loadMoreLabel="Load more recipes"
							contentVersion={`${query}:${sort}:${safetyFilter}:${visibleRecipes.length}`}
							containerElement="div"
							onLoadMore={revealMoreRecipes}
						/>
					{:else}
						<SavedRecipesEmptyState filtered onAction={() => updateQuery("")} />
					{/if}
				{:else}
					<SavedRecipesEmptyState onAction={() => void goto("/mix")} />
				{/if}
			</div>
		</div>
	</ViewBody>
</ViewFrame>

<style lang="scss">
	@use "./page.scss";
</style>
