<script lang="ts">
	import { browser } from "$app/environment";
	import type { FoodItem } from "$lib/utils/food/types";
	import { searchFoodPage } from "$lib/utils/food/sources/fdc";
	import { getUserFacingErrorMessage } from "$lib/utils/errors/userFacingErrors";
	import {
		INGREDIENT_SEARCH_LOAD_MORE_PAGE_SIZE,
		INGREDIENT_SEARCH_PAGE_SIZE,
	} from "$lib/utils/ingredients/ingredientSearchPagination";
	import {
		CUSTOM_FOODS_CHANGED_EVENT,
	} from "$lib/utils/food/custom/customFoods";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import Search from "$lib/assets/icons/Search/Search.svelte";
	import X from "$lib/assets/icons/X/X.svelte";
	import { createEventDispatcher, onMount, tick } from "svelte";
	import type { IngredientSearchProps } from "./types";
	import SearchDropdown from "../SearchDropdown/SearchDropdown.svelte";

	let {
		onSelect,
		onAdd = () => {},
		addingFoodId = null,
		savedFoodIdentityKeys = new Set<string>(),
		onSearchFocus = () => {},
		autofocus = false,
		provenanceOptions = [],
		sourceFilter = "all",
		trustFilter = "any",
		actions,
	}: IngredientSearchProps = $props();
	let query = $state("");
	let results = $state<FoodItem[]>([]);
	let loading = $state(false);
	let loadingMore = $state(false);
	let hasMoreResults = $state(false);
	let nextOffset = $state<number | null>(null);
	let error = $state("");
	let searchReady = $state(false);
	let activeResultIndex = $state(-1);
	let searchWrapElement = $state<HTMLDivElement | null>(null);
	let searchInputElement = $state<HTMLInputElement | null>(null);
	let composing = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout>;
	let searchRequestVersion = 0;
	let activeFilterSignature = "";
	const dispatch = createEventDispatcher();
	const sortedResults = () => results;

	const triggerSearch = () => {
		if (!browser || !searchReady) return;
		clearTimeout(debounceTimer);
		const requestVersion = ++searchRequestVersion;
		error = "";
		loading = false;
		loadingMore = false;
		hasMoreResults = false;
		nextOffset = null;
		const searchString = query.trim();
		if (!searchString) {
			results = [];
			activeResultIndex = -1;
			return;
		}
		debounceTimer = setTimeout(async () => {
			loading = true;
			try {
				const page = await searchFoodPage(searchString, {
					offset: 0,
					limit: INGREDIENT_SEARCH_PAGE_SIZE,
					sourceFilter,
					trustFilter,
				});
				if (requestVersion !== searchRequestVersion) return;
				results = page.foods;
				hasMoreResults = page.hasMore;
				nextOffset = page.nextOffset;
				activeResultIndex = -1;
				dispatch("results", { results, query: searchString });
			} catch (searchError) {
				if (requestVersion !== searchRequestVersion) return;
				results = [];
				hasMoreResults = false;
				nextOffset = null;
				activeResultIndex = -1;
				dispatch("results", { results, query: searchString });
				console.error("[ingredient search] Search failed", searchError);
				error = getUserFacingErrorMessage(searchError, {
					fallback:
						"We couldn't search foods right now. Wait a moment and try again.",
					network:
						"We couldn't connect to food search. Check your connection and try again.",
					timeout:
						"Food search took too long. Check your connection and try again.",
				});
			} finally {
				if (requestVersion === searchRequestVersion) {
					loading = false;
				}
			}
		}, 500);
	};

	const loadMoreResults = async () => {
		const searchString = query.trim();
		const offset = nextOffset;
		if (
			!searchString ||
			offset === null ||
			!hasMoreResults ||
			loading ||
			loadingMore
		) return;

		const requestVersion = searchRequestVersion;
		loadingMore = true;
		error = "";
		try {
			const page = await searchFoodPage(searchString, {
				offset,
				limit: INGREDIENT_SEARCH_LOAD_MORE_PAGE_SIZE,
				sourceFilter,
				trustFilter,
			});
			if (
				requestVersion !== searchRequestVersion ||
				query.trim() !== searchString
			) return;

			results = [...results, ...page.foods];
			hasMoreResults = page.hasMore;
			nextOffset = page.nextOffset;
			dispatch("results", { results, query: searchString });
		} catch {
			if (requestVersion !== searchRequestVersion) return;
			error = "More search results could not be loaded. Try again.";
		} finally {
			if (requestVersion === searchRequestVersion) {
				loadingMore = false;
			}
		}
	};

	const handleInput = (event: Event) => {
		onSearchFocus();
		activeResultIndex = -1;
		if (composing || (event as InputEvent).isComposing) return;
		triggerSearch();
	};

	const handleCompositionEnd = () => {
		composing = false;
		onSearchFocus();
		activeResultIndex = -1;
		triggerSearch();
	};

	const clearSearch = () => {
		clearTimeout(debounceTimer);
		searchRequestVersion += 1;
		query = "";
		results = [];
		error = "";
		loading = false;
		loadingMore = false;
		hasMoreResults = false;
		nextOffset = null;
		activeResultIndex = -1;
		void tick().then(() => searchInputElement?.focus({ preventScroll: true }));
	};

	const hasActiveSearch = $derived(
		query.trim().length > 0 || results.length > 0,
	);

	$effect(() => {
		const resultCount = sortedResults().length;
		if (resultCount === 0) {
			activeResultIndex = -1;
		} else if (activeResultIndex >= resultCount) {
			activeResultIndex = resultCount - 1;
		}
	});

	$effect(() => {
		const filterSignature = `${sourceFilter}:${trustFilter}`;
		if (!searchReady) {
			activeFilterSignature = filterSignature;
			return;
		}
		if (filterSignature === activeFilterSignature) return;
		activeFilterSignature = filterSignature;
		triggerSearch();
	});

	const select = (food: FoodItem) => {
		searchRequestVersion += 1;
		onSelect(food);
		query = "";
		results = [];
		loading = false;
		loadingMore = false;
		hasMoreResults = false;
		nextOffset = null;
		activeResultIndex = -1;
	};

	const selectActiveResult = () => {
		const visibleResults = sortedResults();
		if (visibleResults.length === 0) return false;
		const nextIndex = activeResultIndex >= 0 ? activeResultIndex : 0;
		select(visibleResults[nextIndex]);
		return true;
	};

	const keepActiveResultVisible = async () => {
		await tick();
		const activeFood = sortedResults()[activeResultIndex];
		if (!activeFood) return;

		const activeOption = document.getElementById(
			`ingredient-search-result-${activeFood.fdcId}`,
		);
		activeOption?.scrollIntoView?.({ block: "nearest" });
	};

	const moveActiveResult = (direction: 1 | -1) => {
		const visibleResults = sortedResults();
		if (visibleResults.length === 0) return;
		const currentIndex = activeResultIndex >= 0
			? activeResultIndex
			: direction === 1
				? -1
				: 0;
		activeResultIndex =
			(currentIndex + direction + visibleResults.length) % visibleResults.length;
		void keepActiveResultVisible();
	};

	const handleSearchKeydown = (event: KeyboardEvent) => {
		if (event.defaultPrevented || event.isComposing || composing) return;
		if (event.key === "ArrowDown") {
			event.preventDefault();
			moveActiveResult(1);
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			moveActiveResult(-1);
			return;
		}

		if (event.key === "Enter") {
			if (selectActiveResult()) {
				event.preventDefault();
			}
			return;
		}
	};

	const handleWindowKeydown = (event: KeyboardEvent) => {
		if (!searchWrapElement) return;
		const target = event.target instanceof Node ? event.target : null;
		const activeElement = document.activeElement;
		const eventStartedInSearch = target
			? searchWrapElement.contains(target)
			: false;
		const focusIsInSearch = activeElement
			? searchWrapElement.contains(activeElement)
			: false;
		if (!eventStartedInSearch && !focusIsInSearch) return;
		handleSearchKeydown(event);
	};

	onMount(() => {
		searchReady = true;
		triggerSearch();
		if (autofocus) {
			void tick().then(() => searchInputElement?.focus());
		}

		const refreshCustomResults = () => {
			const searchString = query.trim();
			if (!searchString) return;
			triggerSearch();
		};

		window.addEventListener(CUSTOM_FOODS_CHANGED_EVENT, refreshCustomResults);
		window.addEventListener("keydown", handleWindowKeydown);
		return () => {
			searchReady = false;
			searchRequestVersion += 1;
			clearTimeout(debounceTimer);
			window.removeEventListener(
				CUSTOM_FOODS_CHANGED_EVENT,
				refreshCustomResults,
			);
			window.removeEventListener("keydown", handleWindowKeydown);
		};
	});
</script>

<div bind:this={searchWrapElement} class="search-wrap">
	<label class="sr-only" for="ingredient-search">Search ingredients</label>
	<p id="ingredient-search-keyboard-help" class="sr-only">
		Use the up and down arrow keys to choose a result, then press Enter to view it.
	</p>
	<div class="search-toolbar" class:search-toolbar--with-actions={Boolean(actions)}>
		<div
			class="search-row"
			class:search-row--active={hasActiveSearch}
			aria-busy={loading}
		>
			<Search class="search-icon" />
			<input
				bind:this={searchInputElement}
				id="ingredient-search"
				name="ingredient-search"
				type="search"
				inputmode="search"
				enterkeyhint="search"
				autocomplete="off"
				autocapitalize="none"
				spellcheck={false}
				role="combobox"
				class="search-input"
				placeholder="Search ingredients..."
				bind:value={query}
				onfocus={onSearchFocus}
				oninput={handleInput}
				onkeydown={handleSearchKeydown}
				oncompositionstart={() => (composing = true)}
				oncompositionend={handleCompositionEnd}
				aria-autocomplete="list"
				aria-haspopup="grid"
				aria-controls="ingredient-search-results"
				aria-describedby="ingredient-search-keyboard-help"
				aria-expanded={sortedResults().length > 0}
				aria-activedescendant={activeResultIndex >= 0
					&& sortedResults()[activeResultIndex]
					? `ingredient-search-result-${sortedResults()[activeResultIndex].fdcId}`
					: undefined}
			/>
			{#if loading || query}
				<span class="search-status-actions">
					{#if loading}
						<LoadingSpinner size="small" label="Searching ingredients" />
					{/if}
					{#if query}
						<CircleIconButton
							class="search-clear"
							label="Clear ingredient search"
							variant="ghost"
							size="tiny"
							onclick={clearSearch}
						>
							<X size={16} strokeWidth={2.2} />
						</CircleIconButton>
					{/if}
				</span>
			{/if}
		</div>
		{#if actions}
			<div class="search-actions">
				{@render actions()}
			</div>
		{/if}
	</div>
	{#if sortedResults().length > 0}
		<p class="search-hints" aria-hidden="true">
			<span>↑↓ choose result</span>
			<span>↵ view nutrition</span>
		</p>
	{/if}
	{#if error}
		<StatusMessage tone="danger" message={error} />
	{/if}
	<SearchDropdown
		results={sortedResults()}
		{activeResultIndex}
		{addingFoodId}
		{hasMoreResults}
		{loadingMore}
		contentVersion={`${query.trim()}:${results.length}`}
		{savedFoodIdentityKeys}
		{provenanceOptions}
		onSelect={select}
		{onAdd}
		onActivate={(index) => (activeResultIndex = index)}
		onLoadMore={loadMoreResults}
	/>
</div>

<style lang="scss">
	@use "./IngredientSearch.scss";
</style>
