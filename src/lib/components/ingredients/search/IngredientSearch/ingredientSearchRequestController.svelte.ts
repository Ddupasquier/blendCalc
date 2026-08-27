import { browser } from "$app/environment";
import { getUserFacingErrorMessage } from "$lib/utils/errors/userFacingErrors";
import { searchFoodPage } from "$lib/utils/food/sources/fdc";
import type { FoodItem } from "$lib/utils/food/types";
import {
	INGREDIENT_SEARCH_LOAD_MORE_PAGE_SIZE,
	INGREDIENT_SEARCH_PAGE_SIZE,
} from "$lib/utils/ingredients/ingredientSearchPagination";

type IngredientSearchRequestControllerOptions = {
	getSourceFilter: () => string;
	getTrustFilter: () => string;
	onResultsChanged: (results: FoodItem[], query: string) => void;
};

export const createIngredientSearchRequestController = ({
	getSourceFilter,
	getTrustFilter,
	onResultsChanged,
}: IngredientSearchRequestControllerOptions) => {
	const state = $state({
		query: "",
		results: [] as FoodItem[],
		loading: false,
		loadingMore: false,
		hasMoreResults: false,
		nextOffset: null as number | null,
		error: "",
		completedQuery: "",
		ready: false,
	});
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let requestVersion = 0;
	let activeSearchAbortController: AbortController | null = null;
	let loadMoreAbortController: AbortController | null = null;
	let activeFilterSignature = "";

	const clearDebounceTimer = () => {
		if (debounceTimer === null) return;
		clearTimeout(debounceTimer);
		debounceTimer = null;
	};

	const abortPendingRequests = () => {
		activeSearchAbortController?.abort();
		activeSearchAbortController = null;
		loadMoreAbortController?.abort();
		loadMoreAbortController = null;
	};

	const clearRequestState = () => {
		state.error = "";
		state.loading = false;
		state.loadingMore = false;
		state.hasMoreResults = false;
		state.nextOffset = null;
		state.completedQuery = "";
	};

	const triggerSearch = () => {
		if (!browser || !state.ready) return;
		clearDebounceTimer();
		abortPendingRequests();
		const currentRequestVersion = ++requestVersion;
		clearRequestState();
		const searchQuery = state.query.trim();
		if (!searchQuery) {
			state.results = [];
			return;
		}

		debounceTimer = setTimeout(async () => {
			debounceTimer = null;
			const abortController = new AbortController();
			activeSearchAbortController = abortController;
			state.loading = true;
			try {
				const page = await searchFoodPage(searchQuery, {
					offset: 0,
					limit: INGREDIENT_SEARCH_PAGE_SIZE,
					sourceFilter: getSourceFilter(),
					trustFilter: getTrustFilter(),
					signal: abortController.signal,
				});
				if (currentRequestVersion !== requestVersion) return;
				state.results = page.foods;
				state.hasMoreResults = page.hasMore;
				state.nextOffset = page.nextOffset;
				state.completedQuery = searchQuery;
				onResultsChanged(state.results, searchQuery);
			} catch (searchError) {
				if (
					abortController.signal.aborted ||
					currentRequestVersion !== requestVersion
				) {
					return;
				}
				state.results = [];
				state.hasMoreResults = false;
				state.nextOffset = null;
				onResultsChanged(state.results, searchQuery);
				console.error("[ingredient search] Search failed", searchError);
				state.error = getUserFacingErrorMessage(searchError, {
					fallback:
						"We couldn't search foods right now. Wait a moment and try again.",
					network:
						"We couldn't connect to food search. Check your connection and try again.",
					timeout:
						"Food search took too long. Check your connection and try again.",
				});
			} finally {
				if (activeSearchAbortController === abortController) {
					activeSearchAbortController = null;
				}
				if (currentRequestVersion === requestVersion) {
					state.loading = false;
				}
			}
		}, 500);
	};

	const loadMoreResults = async () => {
		const searchQuery = state.query.trim();
		const offset = state.nextOffset;
		if (
			!searchQuery ||
			offset === null ||
			!state.hasMoreResults ||
			state.loading ||
			state.loadingMore
		) {
			return;
		}

		const currentRequestVersion = requestVersion;
		const abortController = new AbortController();
		loadMoreAbortController = abortController;
		state.loadingMore = true;
		state.error = "";
		try {
			const page = await searchFoodPage(searchQuery, {
				offset,
				limit: INGREDIENT_SEARCH_LOAD_MORE_PAGE_SIZE,
				sourceFilter: getSourceFilter(),
				trustFilter: getTrustFilter(),
				signal: abortController.signal,
			});
			if (
				currentRequestVersion !== requestVersion ||
				state.query.trim() !== searchQuery
			) {
				return;
			}

			state.results = [...state.results, ...page.foods];
			state.hasMoreResults = page.hasMore;
			state.nextOffset = page.nextOffset;
			onResultsChanged(state.results, searchQuery);
		} catch {
			if (
				abortController.signal.aborted ||
				currentRequestVersion !== requestVersion
			) {
				return;
			}
			state.error = "More search results could not be loaded. Try again.";
		} finally {
			if (loadMoreAbortController === abortController) {
				loadMoreAbortController = null;
			}
			if (currentRequestVersion === requestVersion) {
				state.loadingMore = false;
			}
		}
	};

	const clearSearch = () => {
		clearDebounceTimer();
		abortPendingRequests();
		requestVersion += 1;
		state.query = "";
		state.results = [];
		clearRequestState();
	};

	const synchronizeFilters = (filterSignature: string) => {
		if (!state.ready) {
			activeFilterSignature = filterSignature;
			return;
		}
		if (filterSignature === activeFilterSignature) return;
		activeFilterSignature = filterSignature;
		triggerSearch();
	};

	const activate = () => {
		state.ready = true;
		triggerSearch();
	};

	const destroy = () => {
		state.ready = false;
		requestVersion += 1;
		clearDebounceTimer();
		abortPendingRequests();
	};

	return {
		state,
		triggerSearch,
		loadMoreResults,
		clearSearch,
		synchronizeFilters,
		activate,
		destroy,
	};
};

export type IngredientSearchRequestController = ReturnType<
	typeof createIngredientSearchRequestController
>;
