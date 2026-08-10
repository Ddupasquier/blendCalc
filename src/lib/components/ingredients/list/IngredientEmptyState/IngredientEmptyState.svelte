<script lang="ts">
	import Leaf from "$lib/assets/icons/Leaf/Leaf.svelte";
	import ShoppingBag from "$lib/assets/icons/ShoppingBag/ShoppingBag.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame/CircularIconFrame.svelte";
	import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
	import { getIngredientListLabel } from "$lib/utils/ingredients/ingredientListUi";
	import type { IngredientEmptyStateProps } from "./types";

	let {
		activeList,
		hasItems,
	}: IngredientEmptyStateProps = $props();

	const title = $derived(
		activeList === MIX_STORAGE_KEYS.fridge
			? "Your fridge is empty"
			: "Your shopping list is empty",
	);
	const message = $derived.by(() => {
		if (hasItems) {
			return `No ${getIngredientListLabel(activeList).toLowerCase()} ingredients match these filters.`;
		}
		if (activeList === MIX_STORAGE_KEYS.fridge) {
			return "Search above or tap “Enter manually” to add ingredients.";
		}
		return "Search above or scan a barcode to add shopping items.";
	});
</script>

<div class="ingredient-empty-state">
	<CircularIconFrame class="ingredient-empty-state__icon" decorative>
		{#if activeList === MIX_STORAGE_KEYS.fridge}
			<Leaf size="1em" strokeWidth={2.2} />
		{:else}
			<ShoppingBag size="1em" strokeWidth={2.2} />
		{/if}
	</CircularIconFrame>
	<h2>{title}</h2>
	<p>{message}</p>
</div>

<style lang="scss">
	@use "./IngredientEmptyState.scss";
</style>
