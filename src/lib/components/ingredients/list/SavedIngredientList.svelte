<script lang="ts">
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton.svelte";
	import type { FdcFood } from "$lib/utils/food/types";
	import type { FoodPreferenceProfile } from "$lib/utils/profile/foodPreferenceProfile";
	import {
		getFoodDisplayCategory,
		getIngredientActionKey,
		getIngredientListLabel,
		getIngredientMoveLabel,
		getOppositeIngredientListKey,
		getPrimaryFoodWarning,
	} from "$lib/utils/ingredients/ingredientListUi";
	import {
		getIngredientSourceBadgeLabel,
		type IngredientSourceOption,
	} from "$lib/utils/ingredients/ingredientSourceOptions";
	import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
	import { LIST_REVEAL_BUFFER_PX } from "../../../../defaults/listDefaults";
	import { MIX_STORAGE_KEYS } from "../../../../defaults/mixDefaults";
	import IngredientBulkActions from "./IngredientBulkActions.svelte";
	import IngredientEmptyState from "./IngredientEmptyState.svelte";
	import SavedIngredientCard from "./SavedIngredientCard.svelte";

	let {
		activeList,
		foods,
		sourceOptions = [],
		activeRawCount = 0,
		listLoading = false,
		loadingMoreList = null,
		canRevealMore = false,
		selectedFoodId = null,
		selectedIds = [],
		removingItem = null,
		movingItem = null,
		moving = false,
		revealPaused = false,
		preferenceProfile = null,
		resetKey = 0,
		onSelectAll,
		onClearSelection,
		onMoveSelection,
		onMoveItem,
		onToggle,
		onPreview,
		onActions,
		onRemove,
		onRevealMore,
	}: {
		activeList: SmoothieListKey;
		foods: FdcFood[];
		sourceOptions?: IngredientSourceOption[];
		activeRawCount?: number;
		listLoading?: boolean;
		loadingMoreList?: SmoothieListKey | null;
		canRevealMore?: boolean;
		selectedFoodId?: number | null;
		selectedIds?: number[];
		removingItem?: string | null;
		movingItem?: string | null;
		moving?: boolean;
		revealPaused?: boolean;
		preferenceProfile?: FoodPreferenceProfile | null;
		resetKey?: number;
		onSelectAll: () => void;
		onClearSelection: () => void;
		onMoveSelection: () => void;
		onMoveItem: (food: FdcFood) => void | Promise<void>;
		onToggle: (foodId: number) => void;
		onPreview: (food: FdcFood) => void;
		onActions: (food: FdcFood) => void;
		onRemove: (foodId: number) => void;
		onRevealMore: () => void | Promise<void>;
	} = $props();

	let listElement = $state<HTMLUListElement | null>(null);
	let sentinelElement = $state<HTMLLIElement | null>(null);
	let previousActiveList: SmoothieListKey | null = null;
	let previousResetKey: number | null = null;

	const selectedIdSet = $derived(new Set(selectedIds));
	const selectedCount = $derived(selectedIds.length);
	const moveTargetLabel = $derived(
		getIngredientListLabel(getOppositeIngredientListKey(activeList)),
	);

	const requestMoreItems = () => {
		if (revealPaused || !canRevealMore || loadingMoreList) return;
		void onRevealMore();
	};

	const handleListScroll = (event: Event) => {
		const scrollElement = event.currentTarget;
		if (!(scrollElement instanceof HTMLElement)) return;

		const distanceFromBottom =
			scrollElement.scrollHeight -
			scrollElement.scrollTop -
			scrollElement.clientHeight;

		if (distanceFromBottom <= LIST_REVEAL_BUFFER_PX) {
			requestMoreItems();
		}
	};

	$effect(() => {
		if (previousActiveList === null || previousResetKey === null) {
			previousActiveList = activeList;
			previousResetKey = resetKey;
			return;
		}

		if (previousActiveList === activeList && previousResetKey === resetKey) {
			return;
		}

		previousActiveList = activeList;
		previousResetKey = resetKey;
		requestAnimationFrame(() => {
			listElement?.scrollTo({ top: 0, behavior: "auto" });
		});
	});

	$effect(() => {
		const root = listElement;
		const sentinel = sentinelElement;
		if (
			revealPaused ||
			!root ||
			!sentinel ||
			!canRevealMore ||
			loadingMoreList
		) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					requestMoreItems();
				}
			},
			{
				root,
				rootMargin: `${LIST_REVEAL_BUFFER_PX}px 0px`,
			},
		);

		observer.observe(sentinel);
		return () => observer.disconnect();
	});
</script>

<section
	class="saved-ingredient-list"
	class:saved-ingredient-list--with-actions={foods.length > 0}
	aria-label={`${getIngredientListLabel(activeList)} saved ingredients`}
>
	{#if foods.length > 0}
		<IngredientBulkActions
			{selectedCount}
			{moveTargetLabel}
			{moving}
			onSelectAll={onSelectAll}
			onClear={onClearSelection}
			onMove={onMoveSelection}
		/>
	{/if}

	<div class="saved-ingredient-list__body">
		{#key `${activeList}:${resetKey}`}
			{#if foods.length > 0}
				<ul
					class="saved-ingredient-list__cards"
					aria-label={`${getIngredientListLabel(activeList)} ingredients`}
					aria-busy={listLoading || loadingMoreList === activeList}
					bind:this={listElement}
					onscroll={handleListScroll}
				>
					{#each foods as food (food.fdcId)}
						{@const actionKey = getIngredientActionKey(activeList, food.fdcId)}
						{@const warning = getPrimaryFoodWarning(food, preferenceProfile)}
						{@const isChecked = selectedIdSet.has(food.fdcId)}
						<li>
							<SavedIngredientCard
								{food}
								active={selectedFoodId === food.fdcId}
								checked={isChecked}
								moving={movingItem === actionKey}
								removing={removingItem === actionKey}
								moveDirection={activeList === MIX_STORAGE_KEYS.fridge
									? "left"
									: "right"}
								moveLabel={getIngredientMoveLabel(activeList)}
								category={getFoodDisplayCategory(food)}
								{warning}
								sourceLabel={getIngredientSourceBadgeLabel(food, sourceOptions)}
								onToggle={() => onToggle(food.fdcId)}
								onPreview={() => onPreview(food)}
								onMove={() => onMoveItem(food)}
								onActions={() => onActions(food)}
								onRemove={() => onRemove(food.fdcId)}
							/>
						</li>
					{/each}
					{#if canRevealMore}
						<li
							bind:this={sentinelElement}
							class="saved-ingredient-list__sentinel"
							aria-hidden="true"
						></li>
						<li class="saved-ingredient-list__load-more">
							<RoundedActionButton
								variant="soft"
								disabled={loadingMoreList !== null}
								onclick={requestMoreItems}
							>
								{loadingMoreList
									? "Loading…"
									: `Load more ${getIngredientListLabel(activeList).toLowerCase()} items`}
							</RoundedActionButton>
						</li>
					{/if}
				</ul>
			{:else if listLoading}
				<div
					class="saved-ingredient-list__loading"
					role="status"
					aria-live="polite"
				>
					Loading {getIngredientListLabel(activeList).toLowerCase()} ingredients…
				</div>
			{:else}
				<IngredientEmptyState
					{activeList}
					hasItems={activeRawCount > 0}
				/>
			{/if}
		{/key}
	</div>
</section>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.saved-ingredient-list {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	.saved-ingredient-list__body {
		display: flex;
		flex: 1 1 0;
		box-sizing: border-box;
		min-height: 0;
		overflow: hidden;
	}

	.saved-ingredient-list--with-actions .saved-ingredient-list__body {
		padding-top: $app-vertical-stack-gap;
	}

	.saved-ingredient-list__cards {
		display: grid;
		flex: 1 1 auto;
		align-content: start;
		box-sizing: border-box;
		gap: $app-vertical-stack-gap;
		min-height: 0;
		margin: 0;
		padding: 0 0 $app-vertical-stack-gap;
		overflow-y: auto;
		overflow-anchor: none;
		overscroll-behavior: contain;
		scrollbar-gutter: stable;
		-webkit-overflow-scrolling: touch;
		list-style: none;
	}

	.saved-ingredient-list__cards > li {
		min-width: 0;
	}

	.saved-ingredient-list__sentinel {
		min-height: $ingredient-list-sentinel-min-height;
	}

	.saved-ingredient-list__load-more {
		display: grid;
		place-items: center;
		padding: $app-gap-xs 0 $app-gap-sm;
	}

	.saved-ingredient-list__loading {
		display: grid;
		place-items: center;
		flex: 1 1 auto;
		min-height: $ingredient-list-loading-min-height;
		padding: $app-gap-lg;
		color: $ingredient-text-muted;
		background: $ingredient-surface-card;
		border-radius: $ingredient-radius-card;
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-bold;
		text-align: center;
	}
</style>
