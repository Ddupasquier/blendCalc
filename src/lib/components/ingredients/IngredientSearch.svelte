<script lang="ts">
	import type { FdcFood } from "$lib/utils/food/types";
	import { FdcConfigurationError, searchFoods } from "$lib/utils/food/fdc";
	import {
		CUSTOM_FOODS_CHANGED_EVENT,
		searchCustomFoods,
	} from "$lib/utils/food/customFoods";
	import { compareFoodQuality } from "$lib/utils/food/foodQuality";
	import { searchSharedProducts } from "$lib/utils/products/catalog";
	import { createEventDispatcher, onMount } from "svelte";
	import PillRow from "../common/PillRow.svelte";
	import SearchDropdown from "./SearchDropdown.svelte";

	let {
		onSelect,
		onSearchFocus = () => {},
	}: {
		onSelect: (food: FdcFood) => void;
		onSearchFocus?: () => void;
	} = $props();
	let query = $state("");
	let pills = $state<string[]>([]);
	let results = $state<FdcFood[]>([]);
	let loading = $state(false);
	let error = $state("");
	let debounceTimer: ReturnType<typeof setTimeout>;
	const dispatch = createEventDispatcher();

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
			const qualitySort = compareFoodQuality(a, b);
			if (qualitySort !== 0) return qualitySort;
			return a.description.localeCompare(b.description);
		});
	};

	const sortedResults = $derived(() => {
		const allTerms = [...pills, query.trim()]
			.map((s) => s.toLowerCase())
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
		clearTimeout(debounceTimer);
		error = "";
		const allTerms = [...pills, query.trim()].filter(Boolean);
		const searchString = allTerms.join(" ");
		if (!searchString) {
			results = [];
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
		triggerSearch();
	};

	$effect(() => {
		pills;
		triggerSearch();
	});

	const select = (food: FdcFood) => {
		onSelect(food);
		query = "";
		results = [];
	};

	onMount(() => {
		const refreshCustomResults = () => {
			const searchString = [...pills, query.trim()].filter(Boolean).join(" ");
			if (!searchString) return;
			results = mergeResults(searchCustomFoods(searchString), results);
		};

		window.addEventListener(CUSTOM_FOODS_CHANGED_EVENT, refreshCustomResults);
		window.addEventListener("storage", refreshCustomResults);
		return () => {
			window.removeEventListener(
				CUSTOM_FOODS_CHANGED_EVENT,
				refreshCustomResults,
			);
			window.removeEventListener("storage", refreshCustomResults);
		};
	});
</script>

<div class="search-wrap">
	<label class="search-label" for="ingredient-search">Search ingredients</label>
	<div class="search-row">
		<svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
			<path d="m21 21-4.3-4.3m1.3-5.2a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
		</svg>
		<input
			id="ingredient-search"
			name="ingredient-search"
			type="search"
			class="search-input"
			placeholder="Search ingredients..."
			bind:value={query}
			onfocus={onSearchFocus}
			oninput={handleInput}
			onkeydown={(e) => {
				if ((e.key === "Enter" || e.key === " ") && query.trim()) {
					pills = [...pills, query.trim()];
					query = "";
					e.preventDefault();
				}
			}}
		/>
		{#if loading}
			<span class="spinner" aria-label="Searching…">⏳</span>
		{/if}
	</div>
	<PillRow
		{pills}
		onRemove={(idx) => (pills = pills.filter((_, i) => i !== idx))}
	/>
	{#if error}
		<p class="search-error" role="alert">{error}</p>
	{/if}
	<SearchDropdown results={sortedResults()} onSelect={select} />
</div>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.search-wrap {
		position: relative;
		display: grid;
		gap: $app-gap-xs;
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
		min-height: 2.8rem;
		padding: 0 $app-gap-sm;
		background: $app-section-bg;
		border: 1px solid transparent;
		border-radius: $app-card-radius;
		transition: border-color 0.15s ease;

		&:focus-within {
			border-color: $color-orchid-mist;
		}
	}

	.search-icon {
		width: 1rem;
		height: 1rem;
		fill: none;
		stroke: $app-muted;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 2;
	}

	.search-input {
		min-width: 0;
		height: 100%;
		padding: 0;
		color: $app-primary;
		background: transparent;
		border: 0;
		border-radius: 0;
		outline: none;
		font-size: $app-font-size-md;

		&::placeholder {
			color: $app-muted;
		}
	}

	.spinner {
		font-size: $app-font-size-lg;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.search-error {
		padding: 0.45rem 0.6rem;
		color: $app-warning-strong;
		background: $app-warning-bg;
		border: $app-warning-border;
		border-radius: $app-radius-sm;
		font-size: $app-font-size-sm;
		font-weight: 800;
	}
</style>
