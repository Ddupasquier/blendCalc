<script lang="ts">
	import { tick } from "svelte";
	import { flip } from "svelte/animate";
	import PaginatedListControls from "$lib/components/common/navigation/PaginatedListControls/PaginatedListControls.svelte";
	import { animateDirectionalExit } from "$lib/utils/animation/directionalExit";
	import {
		getMotionSafeDuration,
		MOTION_DURATION_MS,
	} from "$lib/utils/animation/motion";
	import {
		getFoodDisplayCategory,
		getIngredientActionKey,
		getIngredientListLabel,
		getIngredientMoveLabel,
		getOppositeIngredientListKey,
		getPrimaryFoodWarning,
	} from "$lib/utils/ingredients/ingredientListUi";
	import { createScrollDirectionTracker } from "$lib/utils/navigation/scrollDirection";
	import type { FdcFood } from "$lib/utils/food/types";
	import type { SavedIngredientListProps } from "./types";
	import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
	import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
	import IngredientBulkActions from "../IngredientBulkActions/IngredientBulkActions.svelte";
	import IngredientEmptyState from "../IngredientEmptyState/IngredientEmptyState.svelte";
	import SavedIngredientCard from "../SavedIngredientCard/SavedIngredientCard.svelte";

	let {
		activeList,
		foods,
		provenanceOptions = [],
		activeRawCount = 0,
		listLoading = false,
		loadingMoreList = null,
		canRevealMore = false,
		selectedFoodId = null,
		selectedIds = [],
		selectionMode = false,
		removingItem = null,
		movingItem = null,
		moving = false,
		revealPaused = false,
		resetKey = 0,
		onSelectAll,
		onEnterSelection,
		onCancelSelection,
		onMoveSelection,
		onMoveItem,
		onToggle,
		onPreview,
		onActions,
		onRemove,
		onRevealMore,
		onScrollDirectionChange = () => {},
	}: SavedIngredientListProps = $props();

	let listElement = $state<HTMLUListElement | null>(null);
	const scrollDirectionTracker = createScrollDirectionTracker();
	let previousActiveList: SmoothieListKey | null = null;
	let previousResetKey: number | null = null;
	let bulkAnimating = $state(false);
	let bulkMoveStatus = $state("");
	let singleAnimatingFoodId = $state<number | null>(null);
	let singleMoveStatus = $state("");
	let scrollResumeFrame: number | null = null;
	let scrollSettleFrame: number | null = null;
	let compactHeaderLayoutSettling = false;

	const BULK_EXIT_STAGGER_MS = 100;
	const BULK_EXIT_ANTICIPATION_PERCENT = 10;
	const selectedIdSet = $derived(new Set(selectedIds));
	const selectedCount = $derived(selectedIds.length);
	const moveTargetLabel = $derived(
		getIngredientListLabel(getOppositeIngredientListKey(activeList)),
	);
	const bulkMoveBusy = $derived(moving || bulkAnimating);
	const bulkMoveDirection = $derived(
		activeList === MIX_STORAGE_KEYS.fridge ? "right" : "left",
	);
	const moveBusy = $derived(
		moving || bulkAnimating || singleAnimatingFoodId !== null,
	);
	const selectionStatus = $derived(
		selectionMode
			? `Selection mode. ${selectedCount} ingredient${selectedCount === 1 ? "" : "s"} selected.`
			: "",
	);
	const listStatus = $derived(
		bulkMoveStatus || singleMoveStatus || selectionStatus,
	);

	const requestMoreItems = () => {
		if (revealPaused || !canRevealMore || loadingMoreList) return;
		void onRevealMore();
	};

	const getListReflowDuration = () =>
		getMotionSafeDuration(MOTION_DURATION_MS.reflow);

	const startCardExit = async (
		foodIds: number[],
		direction: "left" | "right",
		stagger = false,
	) => {
		await tick();
		const targetIds = new Set(foodIds.map(String));
		const cards = Array.from(
			listElement?.querySelectorAll<HTMLElement>(
				"li[data-food-id] > .saved-ingredient-card",
			) ?? [],
		).filter((card) =>
			targetIds.has(card.parentElement?.dataset.foodId ?? ""),
		);
		const animationOptions = stagger
			? {
					anticipationPercent: BULK_EXIT_ANTICIPATION_PERCENT,
					staggerMs: BULK_EXIT_STAGGER_MS,
					unclipFromContainer: true,
				}
			: { unclipFromContainer: true };
		return animateDirectionalExit(cards, direction, animationOptions);
	};

	const moveSelectedItems = async () => {
		if (selectedCount === 0 || moveBusy) return;
		const movingCount = selectedCount;
		const targetLabel = moveTargetLabel;
		const exitDirection = bulkMoveDirection;

		bulkAnimating = true;
		bulkMoveStatus = `Moving ${movingCount} selected ingredient${movingCount === 1 ? "" : "s"} to ${targetLabel}.`;
		const animation = await startCardExit(selectedIds, exitDirection, true);

		try {
			await animation.finished;
			const moved = await onMoveSelection();
			bulkMoveStatus = moved
				? `Moved ${movingCount} ingredient${movingCount === 1 ? "" : "s"} to ${targetLabel}.`
				: "The selected ingredients could not be moved.";
			await tick();
		} finally {
			animation.cancel();
			bulkAnimating = false;
		}
	};

	const moveSingleItem = async (food: FdcFood) => {
		if (moveBusy) return;
		const targetLabel = moveTargetLabel;
		const exitDirection = bulkMoveDirection;

		singleAnimatingFoodId = food.fdcId;
		singleMoveStatus = `Moving ${food.description} to ${targetLabel}.`;
		const animation = await startCardExit([food.fdcId], exitDirection);

		try {
			await animation.finished;
			const moved = await onMoveItem(food);
			singleMoveStatus = moved
				? `Moved ${food.description} to ${targetLabel}.`
				: `${food.description} could not be moved.`;
			if (moved) await tick();
		} finally {
			animation.cancel();
			singleAnimatingFoodId = null;
		}
	};

	const enterSelectionMode = (foodId?: number) => {
		bulkMoveStatus = "";
		if (foodId === undefined) {
			onEnterSelection();
			return;
		}
		onEnterSelection(foodId);
	};

	const cancelScrollTrackingResume = () => {
		if (scrollResumeFrame !== null) cancelAnimationFrame(scrollResumeFrame);
		if (scrollSettleFrame !== null) cancelAnimationFrame(scrollSettleFrame);
		scrollResumeFrame = null;
		scrollSettleFrame = null;
	};

	const resumeScrollTrackingAfterLayoutSettles = (
		element: HTMLUListElement,
	) => {
		cancelScrollTrackingResume();
		scrollResumeFrame = requestAnimationFrame(() => {
			scrollSettleFrame = requestAnimationFrame(() => {
				scrollDirectionTracker.resume(element.scrollTop);
				compactHeaderLayoutSettling = false;
				scrollResumeFrame = null;
				scrollSettleFrame = null;
			});
		});
	};

	const handleListScroll = (event: Event) => {
		const element = event.currentTarget as HTMLUListElement;
		const direction = scrollDirectionTracker.update(element.scrollTop);
		if (direction === "down") {
			compactHeaderLayoutSettling = true;
			scrollDirectionTracker.pause(element.scrollTop);
			resumeScrollTrackingAfterLayoutSettles(element);
		}
		if (direction) onScrollDirectionChange(direction);
	};

	$effect(() => {
		const element = listElement;
		if (!element || typeof ResizeObserver === "undefined") return;

		const observer = new ResizeObserver(() => {
			if (compactHeaderLayoutSettling) {
				scrollDirectionTracker.pause(element.scrollTop);
				resumeScrollTrackingAfterLayoutSettles(element);
				return;
			}

			scrollDirectionTracker.rebase(element.scrollTop);
		});
		observer.observe(element);

		return () => {
			observer.disconnect();
			cancelScrollTrackingResume();
			compactHeaderLayoutSettling = false;
		};
	});

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
		cancelScrollTrackingResume();
		compactHeaderLayoutSettling = false;
		scrollDirectionTracker.reset();
		onScrollDirectionChange("up");
		requestAnimationFrame(() => {
			listElement?.scrollTo({ top: 0, behavior: "auto" });
		});
	});

</script>

<section
	class="saved-ingredient-list"
	class:saved-ingredient-list--with-actions={foods.length > 0}
	aria-label={`${getIngredientListLabel(activeList)} saved ingredients`}
>
	{#if foods.length > 0}
		<IngredientBulkActions
			{selectionMode}
			{selectedCount}
			selectableCount={foods.length}
			{moveTargetLabel}
			moving={bulkMoveBusy}
			onEnterSelection={() => enterSelectionMode()}
			onSelectAll={onSelectAll}
			onCancel={onCancelSelection}
			onMove={moveSelectedItems}
		/>
	{/if}
	<p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
		{listStatus}
	</p>

	<div class="saved-ingredient-list__body">
		{#if foods.length > 0}
			<ul
				class="saved-ingredient-list__cards"
				aria-label={`${getIngredientListLabel(activeList)} ingredients`}
				aria-busy={listLoading || loadingMoreList === activeList || moveBusy}
				bind:this={listElement}
				onscroll={handleListScroll}
			>
				{#each foods as food, index (food.fdcId)}
					{@const actionKey = getIngredientActionKey(activeList, food.fdcId)}
					{@const warning = getPrimaryFoodWarning(food)}
					{@const isChecked = selectedIdSet.has(food.fdcId)}
					<li
						data-food-id={food.fdcId}
						data-bulk-selected={isChecked}
						data-tutorial-target={index === 0 ? "ingredient-card" : undefined}
						animate:flip={{ duration: getListReflowDuration() }}
						class:saved-ingredient-list__card--moving={(bulkMoveBusy && isChecked) ||
							singleAnimatingFoodId === food.fdcId}
					>
						<SavedIngredientCard
							{food}
							active={selectedFoodId === food.fdcId}
							checked={isChecked}
							{selectionMode}
							moving={movingItem === actionKey ||
								singleAnimatingFoodId === food.fdcId ||
								(bulkMoveBusy && isChecked)}
							removing={removingItem === actionKey}
							moveDirection={activeList === MIX_STORAGE_KEYS.fridge
								? "left"
								: "right"}
							moveLabel={getIngredientMoveLabel(activeList)}
							category={getFoodDisplayCategory(food)}
							{warning}
							{provenanceOptions}
							onToggle={() => onToggle(food.fdcId)}
							onEnterSelection={() => enterSelectionMode(food.fdcId)}
							onPreview={() => onPreview(food)}
							onMove={() => moveSingleItem(food)}
							onActions={() => onActions(food)}
							onRemove={() => onRemove(food.fdcId)}
						/>
					</li>
				{/each}
				<PaginatedListControls
					scrollContainer={listElement}
					hasMoreItems={canRevealMore}
					loadingMore={loadingMoreList !== null}
					loadMoreDisabled={revealPaused}
					contentVersion={`${activeList}:${foods.length}:${resetKey}`}
					onLoadMore={requestMoreItems}
				/>
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
	</div>
</section>

<style lang="scss">
	@use "./SavedIngredientList.scss";
</style>
