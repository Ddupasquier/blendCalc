<script lang="ts">
	import PaginatedListControls from "$lib/components/common/navigation/PaginatedListControls/PaginatedListControls.svelte";
	import IngredientSearchCard from "$lib/components/ingredients/search/IngredientSearchCard/IngredientSearchCard.svelte";
	import { getFoodIdentityKey } from "$lib/utils/food/records/foodIdentity";
	import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
	import type { SearchDropdownProps } from "./types";

	let {
		results,
		activeResultIndex = -1,
		addingFoodId = null,
		hasMoreResults = false,
		loadingMore = false,
		contentVersion = 0,
		destinationListKey = MIX_STORAGE_KEYS.fridge,
		destinationListFoodIdentityKeys = new Set<string>(),
		otherListFoodIdentityKeys = new Set<string>(),
		provenanceOptions = [],
		onSelect,
		onAdd = () => {},
		onActivate = () => {},
		onLoadMore = () => {},
	}: SearchDropdownProps = $props();

	let resultsPanelElement = $state<HTMLDivElement | null>(null);

	const requestMoreResults = () => {
		if (!hasMoreResults || loadingMore) return;
		void onLoadMore();
	};
</script>

{#if results.length > 0}
	<div bind:this={resultsPanelElement} class="results-panel">
		<p class="results-summary sr-only" aria-live="polite">
			{results.length} results loaded
		</p>
		<div
			id="ingredient-search-results"
			class="results-list"
			role="grid"
			aria-label="Search results"
			aria-busy={loadingMore}
		>
			{#each results as food, index (food.fdcId)}
				{@const foodIdentityKey = getFoodIdentityKey(food)}
				<IngredientSearchCard
					{food}
					{index}
					active={activeResultIndex === index}
					adding={addingFoodId === food.fdcId}
					{destinationListKey}
					alreadyInDestinationList={destinationListFoodIdentityKeys.has(
						foodIdentityKey,
					)}
					alreadyInOtherList={otherListFoodIdentityKeys.has(foodIdentityKey)}
					{provenanceOptions}
					{onSelect}
					{onAdd}
					{onActivate}
				/>
			{/each}
			<PaginatedListControls
				scrollContainer={resultsPanelElement}
				hasMoreItems={hasMoreResults}
				{loadingMore}
				{contentVersion}
				containerElement="div"
				onLoadMore={requestMoreResults}
			/>
		</div>
	</div>
{/if}

<style lang="scss">
	@use "./SearchDropdown.scss";
</style>
