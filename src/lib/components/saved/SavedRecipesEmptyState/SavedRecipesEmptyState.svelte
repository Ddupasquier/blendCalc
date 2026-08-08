<script lang="ts">
	import Search from "$lib/assets/icons/Search/Search.svelte";
	import Save from "$lib/assets/icons/Save/Save.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame/CircularIconFrame.svelte";
	import type { SavedRecipesEmptyStateProps } from "./types";

	let {
		filtered = false,
		onAction,
	}: SavedRecipesEmptyStateProps = $props();
</script>

<section class="saved-recipes-empty">
	<CircularIconFrame class="saved-recipes-empty__art" decorative>
		{#if filtered}
			<Search size="1em" />
		{:else}
			<Save size="1em" />
		{/if}
	</CircularIconFrame>
	<div class="saved-recipes-empty__copy">
		<h2>{filtered ? "No saved recipes found" : "Save a favorite for next time"}</h2>
		<p>
			{filtered
				? "Try another recipe name or ingredient."
				: "Build a recipe you love, give it a name, and it will be ready to make again here."}
		</p>
	</div>
	<RoundedActionButton variant={filtered ? "soft" : "primary"} onclick={onAction}>
		{filtered ? "Clear search" : "Build a recipe"}
	</RoundedActionButton>
</section>

<style lang="scss">
	@use "./SavedRecipesEmptyState.scss";
</style>
