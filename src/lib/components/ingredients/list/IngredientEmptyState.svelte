<script lang="ts">
	import Leaf from "$lib/assets/icons/Leaf.svelte";
	import ShoppingBag from "$lib/assets/icons/ShoppingBag.svelte";
	import { MIX_STORAGE_KEYS } from "../../../../defaults/mixDefaults";
	import { getIngredientListLabel } from "$lib/utils/ingredients/ingredientListUi";
	import type { SmoothieListKey } from "$lib/utils/storage/smoothieLists";

	let {
		activeList,
		hasItems,
	}: {
		activeList: SmoothieListKey;
		hasItems: boolean;
	} = $props();

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
	<span aria-hidden="true">
		{#if activeList === MIX_STORAGE_KEYS.fridge}
			<Leaf size={30} strokeWidth={2.2} />
		{:else}
			<ShoppingBag size={30} strokeWidth={2.2} />
		{/if}
	</span>
	<h2>{title}</h2>
	<p>{message}</p>
</div>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.ingredient-empty-state {
		display: grid;
		justify-items: center;
		gap: $app-gap-sm;
		min-height: 42vh;
		padding: calc($ingredient-shell-header-height) $app-gap-md;
		color: $ingredient-text-muted;
		text-align: center;
	}

	span {
		display: inline-grid;
		place-items: center;
		width: 4rem;
		height: 4rem;
		background: $ingredient-surface-positive;
		border-radius: $ingredient-radius-card;
		font-size: 2rem;
	}

	h2 {
		margin: 0;
		color: $ingredient-text-primary;
		font-size: $app-font-size-xl;
		font-weight: $app-font-weight-heavy;
	}

	p {
		max-width: 22rem;
		line-height: 1.4;
	}
</style>
