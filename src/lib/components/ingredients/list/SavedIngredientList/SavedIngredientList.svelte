<script lang="ts">
	import { tick } from "svelte";
	import PaginatedListControls from "$lib/components/common/navigation/PaginatedListControls/PaginatedListControls.svelte";
	import { animateDirectionalExit } from "$lib/utils/animation/directionalExit";
	import {
		getFoodDisplayCategory,
		getIngredientActionKey,
		getIngredientListLabel,
		getIngredientMoveLabel,
		getOppositeIngredientListKey,
		getPrimaryFoodWarning,
	} from "$lib/utils/ingredients/ingredientListUi";
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
	}: SavedIngredientListProps = $props();

	let listElement = $state<HTMLUListElement | null>(null);
	let previousActiveList: SmoothieListKey | null = null;
	let previousResetKey: number | null = null;
	let bulkAnimating = $state(false);
	let bulkMoveStatus = $state("");

	const selectedIdSet = $derived(new Set(selectedIds));
	const selectedCount = $derived(selectedIds.length);
	const moveTargetLabel = $derived(
		getIngredientListLabel(getOppositeIngredientListKey(activeList)),
	);
	const bulkMoveBusy = $derived(moving || bulkAnimating);
	const bulkMoveDirection = $derived(
		activeList === MIX_STORAGE_KEYS.fridge ? "right" : "left",
	);

	const requestMoreItems = () => {
		if (revealPaused || !canRevealMore || loadingMoreList) return;
		void onRevealMore();
	};

	const moveSelectedItems = async () => {
		if (selectedCount === 0 || bulkMoveBusy) return;
		const movingCount = selectedCount;
		const targetLabel = moveTargetLabel;
		const exitDirection = bulkMoveDirection;

		bulkAnimating = true;
		bulkMoveStatus = `Moving ${movingCount} checked ingredient${movingCount === 1 ? "" : "s"} to ${targetLabel}.`;
		await tick();

		const selectedCards = Array.from(
			listElement?.querySelectorAll<HTMLElement>(
				'li[data-bulk-selected="true"] > .saved-ingredient-card',
			) ?? [],
		);
		const animation = animateDirectionalExit(selectedCards, exitDirection);

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
			moving={bulkMoveBusy}
			onSelectAll={onSelectAll}
			onClear={onClearSelection}
			onMove={moveSelectedItems}
		/>
	{/if}
	<p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
		{bulkMoveStatus}
	</p>

	<div class="saved-ingredient-list__body">
		{#key `${activeList}:${resetKey}`}
			{#if foods.length > 0}
				<ul
					class="saved-ingredient-list__cards"
					aria-label={`${getIngredientListLabel(activeList)} ingredients`}
					aria-busy={listLoading || loadingMoreList === activeList || bulkMoveBusy}
					bind:this={listElement}
				>
					{#each foods as food (food.fdcId)}
						{@const actionKey = getIngredientActionKey(activeList, food.fdcId)}
						{@const warning = getPrimaryFoodWarning(food, preferenceProfile)}
						{@const isChecked = selectedIdSet.has(food.fdcId)}
						<li
							data-bulk-selected={isChecked}
							class:saved-ingredient-list__card--moving={bulkMoveBusy && isChecked}
						>
							<SavedIngredientCard
								{food}
								active={selectedFoodId === food.fdcId}
								checked={isChecked}
								moving={movingItem === actionKey || (bulkMoveBusy && isChecked)}
								removing={removingItem === actionKey}
								moveDirection={activeList === MIX_STORAGE_KEYS.fridge
									? "left"
									: "right"}
								moveLabel={getIngredientMoveLabel(activeList)}
								category={getFoodDisplayCategory(food)}
								{warning}
								{provenanceOptions}
								onToggle={() => onToggle(food.fdcId)}
								onPreview={() => onPreview(food)}
								onMove={() => onMoveItem(food)}
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
		{/key}
	</div>
</section>

<style lang="scss">
	@use "./SavedIngredientList.scss";
</style>
