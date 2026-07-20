<script lang="ts">
	import { browser } from "$app/environment";
	import type { FdcFood } from "$lib/utils/food/types";
	import {
		FdcConfigurationError,
		searchFoodPage,
	} from "$lib/utils/food/sources/fdc";
	import {
		INGREDIENT_SEARCH_LOAD_MORE_PAGE_SIZE,
		INGREDIENT_SEARCH_PAGE_SIZE,
	} from "$lib/utils/ingredients/ingredientSearchPagination";
	import {
		CUSTOM_FOODS_CHANGED_EVENT,
		searchCustomFoods,
	} from "$lib/utils/food/custom/customFoods";
	import { matchesIngredientProvenance } from "$lib/utils/ingredients/ingredientProvenance";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton.svelte";
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner.svelte";
	import Search from "$lib/assets/icons/Search.svelte";
	import X from "$lib/assets/icons/X.svelte";
	import { createEventDispatcher, onMount, tick } from "svelte";
	import type { IngredientSearchProps } from "$lib/components/ingredients/search/types";
	import SearchDropdown from "./SearchDropdown.svelte";

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
	let results = $state<FdcFood[]>([]);
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
				results = searchCustomFoods(searchString).filter((food) =>
					matchesIngredientProvenance(food, sourceFilter, trustFilter)
				);
				hasMoreResults = false;
				nextOffset = null;
				activeResultIndex = -1;
				dispatch("results", { results, query: searchString });
				error = searchError instanceof FdcConfigurationError
					? searchError.message
					: "Online food search failed. Your saved foods are still available.";
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

	const select = (food: FdcFood) => {
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
		window.addEventListener("storage", refreshCustomResults);
		window.addEventListener("keydown", handleWindowKeydown);
		return () => {
			searchReady = false;
			searchRequestVersion += 1;
			clearTimeout(debounceTimer);
			window.removeEventListener(
				CUSTOM_FOODS_CHANGED_EVENT,
				refreshCustomResults,
			);
			window.removeEventListener("storage", refreshCustomResults);
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
		<p class="search-error" role="alert">{error}</p>
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
	@use "../../../../styles/variables" as *;

	.search-wrap {
		position: relative;
		display: grid;
		gap: $app-horizontal-control-gap;
		min-width: 0;
	}

	.search-toolbar {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-items: center;
		gap: $app-horizontal-control-gap;
		min-width: 0;
	}

	.search-toolbar--with-actions {
		grid-template-columns: minmax(0, 1fr) auto;
	}

	.search-actions {
		display: inline-flex;
		align-items: center;
		gap: $app-horizontal-control-gap;
		min-width: 0;
	}

	.search-row {
		position: relative;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: $app-gap-xs;
		height: $ingredient-control-height;
		min-height: $ingredient-control-height;
		padding: 0 $ingredient-control-padding-x;
		background: $ingredient-surface-control;
		border: 1px solid transparent;
		border-radius: $ingredient-radius-control;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease;

		&:focus-within {
			background: $ingredient-surface-positive;
			border-color: $ingredient-accent-primary;
		}
	}

	.search-row--active {
		background: $ingredient-surface-positive;
		border-color: color-mix(in srgb, $ingredient-accent-primary 42%, transparent);
	}

	:global(.search-icon) {
		width: $ingredient-search-input-icon-size;
		height: $ingredient-search-input-icon-size;
		stroke: $ingredient-text-muted;
	}

	.search-input {
		min-width: 0;
		height: 100%;
		padding: 0;
		color: $ingredient-text-primary;
		background: transparent;
		border: 0;
		border-radius: 0;
		outline: none;
		font-size: $app-font-size-md;

		&::placeholder {
			color: $ingredient-text-muted;
		}

		&::-webkit-search-cancel-button,
		&::-webkit-search-decoration {
			appearance: none;
		}
	}

	.search-status-actions {
		display: inline-flex;
		align-items: center;
		gap: $app-gap-inline-compact;
		min-width: 0;
	}

	.search-hints {
		display: flex;
		flex-wrap: wrap;
		gap: $app-gap-xs $app-gap-sm;
		margin: 0;
		color: $ingredient-text-muted;
		font-size: $app-font-size-xs;
		font-weight: $app-font-weight-semibold;
		line-height: 1.25;

		span + span::before {
			content: "·";
			margin-right: $app-gap-sm;
			color: color-mix(in srgb, $ingredient-text-muted 62%, transparent);
		}
	}

	.search-error {
		padding: $ingredient-control-padding-y-compact $ingredient-control-padding-x-compact;
		color: $app-warning-strong;
		background: $app-warning-bg;
		border: $app-warning-border;
		border-radius: $app-radius-sm;
		margin-top: $app-gap-xs;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-heavy;
	}
</style>
