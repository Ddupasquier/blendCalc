<script lang="ts">
	import {
		goto,
		pushState,
		replaceState as replaceNavigationState,
	} from "$app/navigation";
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
	import SavedDrinkCard from "$lib/components/saved/SavedDrinkCard/SavedDrinkCard.svelte";
	import SavedDrinksEmptyState from "$lib/components/saved/SavedDrinksEmptyState/SavedDrinksEmptyState.svelte";
	import { LIST_PAGE_SIZES } from "$lib/config/listPagination";
	import { getAppDocumentTitle } from "$lib/config/pageMetadata";
	import {
		getMotionSafeDuration,
		MOTION_DURATION_MS,
	} from "$lib/utils/animation/motion";
	import { filterItemsByQuery } from "$lib/utils/list/listNavigation";
	import { createScrollDirectionTracker } from "$lib/utils/navigation/scrollDirection";
	import {
		deleteSavedDrink,
		normalizeSavedDrink,
		restoreSavedDrinkToMix,
		SAVED_DRINKS_CHANGED_EVENT,
		type SavedDrink,
	} from "$lib/utils/storage/client/savedDrinks";
	import { readCloudSavedDrinks } from "$lib/utils/storage/supabase";

	const initialSavedData = page.data.savedData;
	let drinks = $state<SavedDrink[]>(
		(initialSavedData?.drinks ?? []).map(normalizeSavedDrink),
	);
	let query = $state("");
	let sort = $state("newest");
	let visibleCount = $state<number>(LIST_PAGE_SIZES.savedDrinks);
	let deletingDrinkId = $state<string | null>(null);
	let loadingDrinkId = $state<string | null>(null);
	let deleteError = $state("");
	let loadError = $state(initialSavedData?.loadError ?? "");
	let loadingDrinks = $state(false);
	let scrollContainer = $state<HTMLElement | null>(null);
	let compactTopHidden = $state(false);
	const scrollDirectionTracker = createScrollDirectionTracker();

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
	const visibleDrinks = $derived(filteredDrinks.slice(0, visibleCount));
	const hasMoreDrinks = $derived(
		visibleDrinks.length < filteredDrinks.length,
	);
	const sortSheetOpen = $derived(page.url.pathname === "/saved/sort");
	const documentTitle = $derived(getAppDocumentTitle(page.url));

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
		} catch {
			loadError = "We couldn't open that mix. Please try again.";
		} finally {
			loadingDrinkId = null;
		}
	};

	const removeDrink = async (drink: SavedDrink) => {
		if (deletingDrinkId) return;

		deletingDrinkId = drink.id;
		deleteError = "";
		try {
			const deleted = await deleteSavedDrink(drink.id, {
				notify: false,
			});
			if (!deleted) {
				deleteError = "We couldn't delete that mix. Please try again.";
				return;
			}
			drinks = drinks.filter((savedDrink) => savedDrink.id !== drink.id);
		} catch {
			deleteError = "We couldn't delete that mix. Please try again.";
		} finally {
			deletingDrinkId = null;
		}
	};

	const updateQuery = (value: string) => {
		query = value;
		visibleCount = LIST_PAGE_SIZES.savedDrinks;
		compactTopHidden = false;
		scrollDirectionTracker.reset(scrollContainer?.scrollTop ?? 0);
	};

	const updateSort = (value: string) => {
		sort = value;
		visibleCount = LIST_PAGE_SIZES.savedDrinks;
		compactTopHidden = false;
		scrollDirectionTracker.reset(scrollContainer?.scrollTop ?? 0);
	};

	const openSortSheet = () => {
		if (sortSheetOpen) return;
		compactTopHidden = false;
		pushState("/saved/sort", { ...page.state });
	};

	const closeSortSheet = () => {
		if (!sortSheetOpen) return;
		replaceNavigationState("/saved", { ...page.state });
	};

	const applySort = (value: string) => {
		updateSort(value);
		closeSortSheet();
	};

	const revealMoreDrinks = () => {
		visibleCount += LIST_PAGE_SIZES.savedDrinks;
	};

	const getListReflowDuration = () =>
		getMotionSafeDuration(MOTION_DURATION_MS.reflow);

	const handleSavedScroll = (event: Event) => {
		if (sortSheetOpen) return;
		const direction = scrollDirectionTracker.update(
			(event.currentTarget as HTMLElement).scrollTop,
		);
		if (direction) compactTopHidden = direction === "down";
	};

	onMount(() => {
		window.addEventListener(SAVED_DRINKS_CHANGED_EVENT, loadSavedDrinks);
		return () => {
			window.removeEventListener(
				SAVED_DRINKS_CHANGED_EVENT,
				loadSavedDrinks,
			);
		};
	});
</script>

<svelte:head>
	<title>{documentTitle}</title>
</svelte:head>

<ListSortSheet
	open={sortSheetOpen}
	value={sort}
	options={sortOptions}
	titleId="saved-sort-sheet-title"
	label="Sort saved drinks"
	onApply={applySort}
	onClose={closeSortSheet}
/>

<ViewFrame appShell className="saved-page">
	<ViewTop compactHidden={compactTopHidden}>
		<ViewHeader
			title="Saved Drinks"
			subtitle="Revisit combinations you’ve saved and load them back into Mix whenever you need them."
		/>

		{#if drinks.length > 0}
			<ListControls
				id="saved-drinks-search"
					{query}
					onQueryChange={updateQuery}
					placeholder="Search saved drinks…"
					label="Search saved drinks by name or ingredient"
					totalCount={drinks.length}
					visibleCount={filteredDrinks.length}
					itemLabel="mixes"
					filterLabel="Sort saved mixes"
					filterValue={sort}
					filterOptions={sortOptions}
					filtersActive={sortSheetOpen}
					filterControlsId="saved-sort-sheet-title"
					onFilterOpen={openSortSheet}
				/>
		{/if}
	</ViewTop>

	<ViewBody>
		<div
			class="saved-page__scroll"
			bind:this={scrollContainer}
			onscroll={handleSavedScroll}
		>
			<div class="saved-page__content">
				{#if deleteError}
					<StatusMessage tone="danger" message={deleteError} />
				{/if}
				{#if loadError}
					<StatusMessage tone="danger" message={loadError} />
				{/if}

				{#if loadingDrinks && drinks.length === 0}
					<section class="saved-page__loading" aria-busy="true">
						<LoadingSpinner label="Loading saved mixes" showLabel />
					</section>
				{:else if drinks.length > 0}
					{#if visibleDrinks.length > 0}
						<ul class="saved-page__list" aria-label="Saved mixes">
							{#each visibleDrinks as drink, index (drink.id)}
								<li
									data-tutorial-target={index === 0 ? "saved-mix" : undefined}
									animate:flip={{ duration: getListReflowDuration() }}
								>
									<SavedDrinkCard
										{drink}
										loading={loadingDrinkId === drink.id}
										deleting={deletingDrinkId === drink.id}
										disabled={loadingDrinkId !== null ||
											deletingDrinkId !== null}
										onLoad={(selectedDrink) =>
											void loadDrink(selectedDrink)}
										onDelete={(selectedDrink) =>
											void removeDrink(selectedDrink)}
									/>
								</li>
							{/each}
						</ul>
						<PaginatedListControls
							{scrollContainer}
							hasMoreItems={hasMoreDrinks}
							loadMoreLabel="Load more mixes"
							contentVersion={`${query}:${sort}:${visibleDrinks.length}`}
							containerElement="div"
							onLoadMore={revealMoreDrinks}
						/>
					{:else}
						<SavedDrinksEmptyState
							filtered
							onAction={() => updateQuery("")}
						/>
					{/if}
				{:else}
					<SavedDrinksEmptyState onAction={() => void goto("/mix")} />
				{/if}
			</div>
		</div>
	</ViewBody>
</ViewFrame>

<style lang="scss">
	@use "./page.scss";
</style>
