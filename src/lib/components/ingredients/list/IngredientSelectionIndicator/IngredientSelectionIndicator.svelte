<script lang="ts">
	import Check from "$lib/assets/icons/Check/Check.svelte";
	import type { IngredientSelectionIndicatorProps } from "./types";

	let { selected = false }: IngredientSelectionIndicatorProps = $props();
</script>

<span
	class="ingredient-selection-indicator"
	class:ingredient-selection-indicator--selected={selected}
	aria-hidden="true"
>
	{#if selected}
		<Check size="1.25em" strokeWidth={3} />
	{/if}
</span>

<style lang="scss">
	@use "./IngredientSelectionIndicator.scss";
</style>
