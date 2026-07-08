<script lang="ts">
	import Search from "$lib/assets/icons/Search.svelte";
	import type { IngredientSearchTriggerProps } from "$lib/components/ingredients/search/types";

	let {
		label = "Search ingredients...",
		onOpen,
	}: IngredientSearchTriggerProps = $props();
</script>

<button
	class="ingredient-search-trigger"
	type="button"
	aria-label="Open ingredient search"
	onclick={onOpen}
>
	<Search class="ingredient-search-trigger__icon" />
	<span>{label}</span>
</button>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.ingredient-search-trigger {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: $app-gap-xs;
		width: 100%;
		height: $ingredient-control-height;
		min-height: $ingredient-control-height;
		padding: 0 $ingredient-control-padding-x;
		color: $ingredient-text-muted;
		background: $ingredient-surface-control;
		border: 1px solid transparent;
		border-radius: $ingredient-radius-control;
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-regular;
		text-align: left;
		transition:
			background-color 160ms ease,
			border-color 160ms ease;

		&:hover,
		&:focus-visible {
			background: $ingredient-surface-positive;
			border-color: $ingredient-accent-primary;
			outline: none;
		}

		span {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	:global(.ingredient-search-trigger__icon) {
		width: 1rem;
		height: 1rem;
		stroke: currentColor;
	}
</style>
