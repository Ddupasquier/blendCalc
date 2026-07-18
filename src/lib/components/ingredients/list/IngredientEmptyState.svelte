<script lang="ts">
	import Leaf from "$lib/assets/icons/Leaf.svelte";
	import ShoppingBag from "$lib/assets/icons/ShoppingBag.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame.svelte";
	import { MIX_STORAGE_KEYS } from "../../../../defaults/mixDefaults";
	import { getIngredientListLabel } from "$lib/utils/ingredients/ingredientListUi";
	import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";

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
	@use "../../../../styles/variables" as *;

	.ingredient-empty-state {
		display: grid;
		justify-items: center;
		gap: $app-gap-sm;
		min-height: $ingredient-empty-state-min-height;
		padding: calc($ingredient-shell-header-height) $app-gap-md;
		color: $ingredient-text-muted;
		text-align: center;
	}

	:global(.ingredient-empty-state__icon) {
		--circular-icon-frame-size: #{$ingredient-empty-state-icon-size};
		--circular-icon-frame-icon-size: #{$ingredient-empty-state-icon-font-size};
		--circular-icon-frame-background: #{$ingredient-surface-positive};
		--circular-icon-frame-border: 0;
	}

	h2 {
		margin: 0;
		color: $ingredient-text-primary;
		font-size: $app-font-size-xl;
		font-weight: $app-font-weight-heavy;
	}

	p {
		max-width: $ingredient-empty-state-copy-max-width;
		line-height: 1.4;
	}
</style>
