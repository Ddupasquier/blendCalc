<script lang="ts">
	import type { FoodItem } from "$lib/utils/food/types";
	import { CUSTOM_FOODS_CHANGED_EVENT } from "$lib/utils/food/custom/customFoods";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import Search from "$lib/assets/icons/Search/Search.svelte";
	import X from "$lib/assets/icons/X/X.svelte";
	import { createEventDispatcher, onMount, tick } from "svelte";
	import type { IngredientSearchProps } from "./types";
	import { createIngredientSearchRequestController } from "./ingredientSearchRequestController.svelte";
	import SearchDropdown from "../SearchDropdown/SearchDropdown.svelte";
	import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";

	let {
		onSelect,
		onAdd = () => {},
		addingFoodId = null,
		destinationListKey = MIX_STORAGE_KEYS.fridge,
		destinationListFoodIdentityKeys = new Set<string>(),
		otherListFoodIdentityKeys = new Set<string>(),
		onSearchFocus = () => {},
		autofocus = false,
		provenanceOptions = [],
		sourceFilter = "all",
		trustFilter = "any",
		actions,
	}: IngredientSearchProps = $props();
	let activeResultIndex = $state(-1);
	let searchWrapElement = $state<HTMLDivElement | null>(null);
	let searchInputElement = $state<HTMLInputElement | null>(null);
	let composing = $state(false);
	const dispatch = createEventDispatcher();
	const searchRequest = createIngredientSearchRequestController({
		getSourceFilter: () => sourceFilter,
		getTrustFilter: () => trustFilter,
		onResultsChanged: (results, query) => {
			activeResultIndex = -1;
			dispatch("results", { results, query });
		},
	});
	const sortedResults = () => searchRequest.state.results;

	const handleInput = (event: Event) => {
		onSearchFocus();
		activeResultIndex = -1;
		if (composing || (event as InputEvent).isComposing) return;
		searchRequest.triggerSearch();
	};

	const handleCompositionEnd = () => {
		composing = false;
		onSearchFocus();
		activeResultIndex = -1;
		searchRequest.triggerSearch();
	};

	const clearSearch = () => {
		searchRequest.clearSearch();
		activeResultIndex = -1;
		void tick().then(() => searchInputElement?.focus({ preventScroll: true }));
	};

	const hasActiveSearch = $derived(
		searchRequest.state.query.trim().length > 0 ||
			searchRequest.state.results.length > 0,
	);
	const showEmptySearchMessage = $derived(
		searchRequest.state.completedQuery.length > 0 &&
			searchRequest.state.completedQuery === searchRequest.state.query.trim() &&
			searchRequest.state.results.length === 0 &&
			!searchRequest.state.loading &&
			!searchRequest.state.error,
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
		searchRequest.synchronizeFilters(filterSignature);
	});

	const select = (food: FoodItem) => {
		onSelect(food);
		searchRequest.clearSearch();
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
		const currentIndex =
			activeResultIndex >= 0 ? activeResultIndex : direction === 1 ? -1 : 0;
		activeResultIndex =
			(currentIndex + direction + visibleResults.length) %
			visibleResults.length;
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
		searchRequest.activate();
		if (autofocus) {
			void tick().then(() => searchInputElement?.focus());
		}

		const refreshCustomResults = () => {
			const searchString = searchRequest.state.query.trim();
			if (!searchString) return;
			searchRequest.triggerSearch();
		};

		window.addEventListener(CUSTOM_FOODS_CHANGED_EVENT, refreshCustomResults);
		window.addEventListener("keydown", handleWindowKeydown);
		return () => {
			searchRequest.destroy();
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
		Use the up and down arrow keys to choose a result, then press Enter to view
		it.
	</p>
	<div
		class="search-toolbar"
		class:search-toolbar--with-actions={Boolean(actions)}
	>
		<div
			class="search-row"
			class:search-row--active={hasActiveSearch}
			aria-busy={searchRequest.state.loading}
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
				bind:value={searchRequest.state.query}
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
				aria-activedescendant={activeResultIndex >= 0 &&
				sortedResults()[activeResultIndex]
					? `ingredient-search-result-${sortedResults()[activeResultIndex].fdcId}`
					: undefined}
			/>
			{#if searchRequest.state.loading || searchRequest.state.query}
				<span class="search-status-actions">
					{#if searchRequest.state.loading}
						<LoadingSpinner size="small" label="Searching ingredients" />
					{/if}
					{#if searchRequest.state.query}
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
	{#if searchRequest.state.error}
		<StatusMessage tone="danger" message={searchRequest.state.error} />
	{:else if showEmptySearchMessage}
		<StatusMessage
			tone="info"
			title="Nothing found"
			message={`We couldn't find a match for “${searchRequest.state.completedQuery}”. Try another name, brand, category, ingredient, or barcode.`}
		/>
	{/if}
	<SearchDropdown
		results={sortedResults()}
		{activeResultIndex}
		{addingFoodId}
		hasMoreResults={searchRequest.state.hasMoreResults}
		loadingMore={searchRequest.state.loadingMore}
		contentVersion={`${searchRequest.state.query.trim()}:${searchRequest.state.results.length}`}
		{destinationListKey}
		{destinationListFoodIdentityKeys}
		{otherListFoodIdentityKeys}
		{provenanceOptions}
		onSelect={select}
		{onAdd}
		onActivate={(index) => (activeResultIndex = index)}
		onLoadMore={searchRequest.loadMoreResults}
	/>
</div>

<style lang="scss">
	@use "./IngredientSearch.scss";
</style>
