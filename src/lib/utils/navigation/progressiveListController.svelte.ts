import { SvelteMap } from "svelte/reactivity";

export type ProgressiveListPage<Row> = {
	items: Row[];
	total: number;
	nextCursor: string | null;
	revision?: string;
};
type QueueItem = { id: string };
type FetchPage<Page> = (
	cursor: string | null,
	signal: AbortSignal,
) => Promise<Page>;

export const createProgressiveListController = <
	Row extends QueueItem,
	Page extends ProgressiveListPage<Row> = ProgressiveListPage<Row>,
>(
	initial: Page,
	fetchPage: FetchPage<Page>,
) => {
	const state = $state({
		page: initial,
		items: initial.items,
		total: initial.total,
		nextCursor: initial.nextCursor,
		loading: false,
		refreshing: false,
		error: "",
	});
	let controller: AbortController | null = null;
	let loadedPageCount = 1;
	let refreshNeeded = $state(false);
	const uniqueItems = (items: Row[]) => [
		...new SvelteMap(items.map((item) => [item.id, item])).values(),
	];

	const refresh = async (firstPage?: Page) => {
		controller?.abort();
		const request = new AbortController();
		controller = request;
		state.refreshing = true;
		state.loading = false;
		state.error = "";
		refreshNeeded = true;
		try {
			let page = firstPage ?? (await fetchPage(null, request.signal));
			const revision = page.revision;
			const items = [...page.items];
			let refreshedPages = 1;
			while (refreshedPages < loadedPageCount && page.nextCursor) {
				page = await fetchPage(page.nextCursor, request.signal);
				if (revision !== undefined && page.revision !== revision)
					throw new Error("Queue changed during refresh.");
				items.push(...page.items);
				refreshedPages += 1;
			}
			if (request.signal.aborted) return;
			state.page = page;
			state.items = uniqueItems(items);
			state.total = page.total;
			state.nextCursor = page.nextCursor;
			loadedPageCount = refreshedPages;
			refreshNeeded = false;
		} catch {
			if (!request.signal.aborted) {
				state.error =
					"The queue could not refresh. Your loaded cards are still here. Retry before making another decision.";
			}
		} finally {
			if (controller === request) {
				controller = null;
				state.refreshing = false;
			}
		}
	};

	const loadMore = async () => {
		if (state.loading || state.refreshing) return;
		if (refreshNeeded) return refresh();
		const cursor = state.nextCursor;
		if (!cursor) return;
		const request = new AbortController();
		controller = request;
		state.loading = true;
		state.error = "";
		try {
			const page = await fetchPage(cursor, request.signal);
			if (request.signal.aborted) return;
			if (
				page.total !== state.total ||
				(page.revision !== undefined && page.revision !== state.page.revision)
			) {
				// A concurrent decision changed membership. Reconcile the visible depth
				// before exposing new cards, rather than retaining resolved work.
				loadedPageCount += 1;
				await refresh();
				return;
			}
			state.page = page;
			state.items = uniqueItems([...state.items, ...page.items]);
			state.total = page.total;
			state.nextCursor = page.nextCursor;
			loadedPageCount += 1;
		} catch {
			if (!request.signal.aborted) {
				state.error =
					"More work could not load. Your loaded cards are still here. Try again.";
			}
		} finally {
			if (controller === request) {
				controller = null;
				state.loading = false;
			}
		}
	};

	return {
		state,
		loadMore,
		refresh,
		get needsRefresh() {
			return refreshNeeded;
		},
		destroy: () => controller?.abort(),
	};
};
