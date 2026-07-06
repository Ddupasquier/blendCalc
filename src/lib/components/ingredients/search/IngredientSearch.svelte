<script lang="ts">
	import { browser } from "$app/environment";
	import type { FdcFood } from "$lib/utils/food/types";
	import { FdcConfigurationError, searchFoods } from "$lib/utils/food/sources/fdc";
	import {
		CUSTOM_FOODS_CHANGED_EVENT,
		searchCustomFoods,
	} from "$lib/utils/food/custom/customFoods";
	import { compareFoodQuality } from "$lib/utils/food/quality/foodQuality";
	import { getFoodPreferenceContext } from "$lib/utils/profile/foodPreferenceContext.svelte";
	import { getFoodDownrankScore } from "$lib/utils/profile/foodPreferenceWarnings";
	import { searchSharedProducts } from "$lib/utils/products/catalog";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton.svelte";
	import Search from "$lib/assets/icons/Search.svelte";
	import X from "$lib/assets/icons/X.svelte";
	import type { Snippet } from "svelte";
	import { createEventDispatcher, onMount, tick } from "svelte";
	import SearchDropdown from "./SearchDropdown.svelte";

	let {
		onSelect,
		onAdd = () => {},
		addingFoodId = null,
		onSearchFocus = () => {},
		autofocus = false,
		actions,
	}: {
		onSelect: (food: FdcFood) => void;
		onAdd?: (food: FdcFood) => void | Promise<void>;
		addingFoodId?: number | null;
		onSearchFocus?: () => void;
		autofocus?: boolean;
		actions?: Snippet;
	} = $props();
	let query = $state("");
	let results = $state<FdcFood[]>([]);
	let loading = $state(false);
	let error = $state("");
	let searchReady = $state(false);
	let activeResultIndex = $state(-1);
	let searchWrapElement = $state<HTMLDivElement | null>(null);
	let searchInputElement = $state<HTMLInputElement | null>(null);
	let debounceTimer: ReturnType<typeof setTimeout>;
	const dispatch = createEventDispatcher();
	const foodPreferenceContext = getFoodPreferenceContext();

	const mergeResults = (...resultGroups: FdcFood[][]) => {
		const seen = new Set<number>();
		const seenBarcodes = new Set<string>();
		return resultGroups.flat().filter((food) => {
			if (seen.has(food.fdcId)) return false;
			const barcode = food.barcode ?? food.gtinUpc;
			if (barcode && seenBarcodes.has(barcode)) return false;
			seen.add(food.fdcId);
			if (barcode) seenBarcodes.add(barcode);
			return true;
		});
	};

	const sortByQualityThenName = (items: FdcFood[]) => {
		return items.sort((a, b) => {
			const preferencePenalty =
				getFoodDownrankScore(a, foodPreferenceContext.current) -
				getFoodDownrankScore(b, foodPreferenceContext.current);
			if (preferencePenalty !== 0) return preferencePenalty;
			const qualitySort = compareFoodQuality(a, b);
			if (qualitySort !== 0) return qualitySort;
			return a.description.localeCompare(b.description);
		});
	};

	const sortedResults = $derived(() => {
		const allTerms = query.trim()
			.toLowerCase()
			.split(/\s+/)
			.filter(Boolean);
		if (allTerms.length === 0)
			return sortByQualityThenName([...results]);
		if (allTerms.length === 1) {
			const startsWith: FdcFood[] = [];
			const contains: FdcFood[] = [];
			const rest: FdcFood[] = [];
			for (const food of results) {
				const desc = food.description.toLowerCase();
				if (desc.startsWith(allTerms[0])) {
					startsWith.push(food);
				} else if (desc.includes(allTerms[0])) {
					contains.push(food);
				} else {
					rest.push(food);
				}
			}
			sortByQualityThenName(startsWith);
			sortByQualityThenName(contains);
			sortByQualityThenName(rest);
			return [...startsWith, ...contains, ...rest];
		}
		const allParts: FdcFood[] = [];
		const firstPart: FdcFood[] = [];
		const rest: FdcFood[] = [];
		for (const food of results) {
			const desc = food.description.toLowerCase();
			const containsAll = allTerms.every((p) => desc.includes(p));
			if (containsAll) {
				if (desc.startsWith(allTerms[0])) {
					firstPart.push(food);
				} else {
					allParts.push(food);
				}
			} else {
				rest.push(food);
			}
		}
		sortByQualityThenName(firstPart);
		sortByQualityThenName(allParts);
		sortByQualityThenName(rest);
		return [...firstPart, ...allParts, ...rest];
	});

	const triggerSearch = () => {
		if (!browser || !searchReady) return;
		clearTimeout(debounceTimer);
		error = "";
		const searchString = query.trim();
		if (!searchString) {
			results = [];
			activeResultIndex = -1;
			return;
		}
		debounceTimer = setTimeout(async () => {
			loading = true;
			const customResults = searchCustomFoods(searchString);
			try {
				const [sharedSearch, apiSearch] = await Promise.allSettled([
					searchSharedProducts(searchString),
					searchFoods(searchString),
				]);
				const sharedResults = sharedSearch.status === "fulfilled"
					? sharedSearch.value
					: [];
				const apiResults = apiSearch.status === "fulfilled"
					? apiSearch.value
					: [];
				results = mergeResults(customResults, sharedResults, apiResults);
				activeResultIndex = -1;
				dispatch("results", { results, query: searchString });

				if (sharedSearch.status === "rejected" && apiSearch.status === "rejected") {
					const apiError = apiSearch.reason;
					error = apiError instanceof FdcConfigurationError
						? apiError.message
						: "Online food search failed. Your saved foods are still available.";
				}
			} finally {
				loading = false;
			}
		}, 500);
	};

	const handleInput = () => {
		onSearchFocus();
		activeResultIndex = -1;
		triggerSearch();
	};

	const clearSearch = () => {
		clearTimeout(debounceTimer);
		query = "";
		results = [];
		error = "";
		activeResultIndex = -1;
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

	const select = (food: FdcFood) => {
		onSelect(food);
		query = "";
		results = [];
		activeResultIndex = -1;
	};

	const selectActiveResult = () => {
		const visibleResults = sortedResults();
		if (visibleResults.length === 0) return false;
		const nextIndex = activeResultIndex >= 0 ? activeResultIndex : 0;
		select(visibleResults[nextIndex]);
		return true;
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
	};

	const handleSearchKeydown = (event: KeyboardEvent) => {
		if (event.defaultPrevented) return;
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
			results = mergeResults(searchCustomFoods(searchString), results);
		};

		window.addEventListener(CUSTOM_FOODS_CHANGED_EVENT, refreshCustomResults);
		window.addEventListener("storage", refreshCustomResults);
		window.addEventListener("keydown", handleWindowKeydown);
		return () => {
			searchReady = false;
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
	<label class="search-label" for="ingredient-search">Search ingredients</label>
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
				role="combobox"
				class="search-input"
				placeholder="Search ingredients..."
				bind:value={query}
				onfocus={onSearchFocus}
				oninput={handleInput}
				aria-autocomplete="list"
				aria-controls="ingredient-search-results"
				aria-expanded={sortedResults().length > 0}
				aria-activedescendant={activeResultIndex >= 0
					&& sortedResults()[activeResultIndex]
					? `ingredient-search-result-${sortedResults()[activeResultIndex].fdcId}`
					: undefined}
			/>
			{#if loading || query}
				<span class="search-status-actions">
					{#if loading}
						<span class="spinner" role="status" aria-live="polite">
							<span class="sr-only">Searching…</span>
						</span>
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
		onSelect={select}
		{onAdd}
		onActivate={(index) => (activeResultIndex = index)}
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

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.search-label {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
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
		width: 1rem;
		height: 1rem;
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

	.spinner {
		width: 0.9rem;
		height: 0.9rem;
		border: 2px solid color-mix(in srgb, $ingredient-text-muted 28%, transparent);
		border-top-color: $ingredient-accent-primary;
		border-radius: $ingredient-radius-pill;
		animation: ingredient-search-spin 700ms linear infinite;
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

	@keyframes ingredient-search-spin {
		to {
			transform: rotate(360deg);
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
