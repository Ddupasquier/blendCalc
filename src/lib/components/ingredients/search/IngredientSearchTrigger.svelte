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
		height: $app-shell-control-height;
		min-height: $app-shell-control-height;
		padding: 0 $app-shell-control-padding-x;
		color: $app-shell-text-muted;
		background: $app-shell-surface-control;
		border: 1px solid transparent;
		border-radius: $app-shell-radius-control;
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-regular;
		text-align: left;
		transition:
			background-color 160ms ease,
			border-color 160ms ease;

		&:hover,
		&:focus-visible {
			background: $app-shell-accent-soft;
			border-color: $app-shell-accent-primary;
			outline: none;
		}

		span {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	:global(.ingredient-search-trigger__icon) {
		width: $app-font-size-md;
		height: $app-font-size-md;
		stroke: currentColor;
	}
</style>
