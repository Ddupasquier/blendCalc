<script lang="ts">
	import Search from "$lib/assets/icons/Search/Search.svelte";
	import type { IngredientSearchTriggerProps } from "./types";

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
	@use "./IngredientSearchTrigger.scss";
</style>
