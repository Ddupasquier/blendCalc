<script lang="ts">
	import Search from "$lib/assets/icons/Search/Search.svelte";
	import SmoothieCup from "$lib/assets/icons/SmoothieCup/SmoothieCup.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame/CircularIconFrame.svelte";
	import type { SavedDrinksEmptyStateProps } from "./types";

	let {
		filtered = false,
		onAction,
	}: SavedDrinksEmptyStateProps = $props();
</script>

<section class="saved-drinks-empty">
	<CircularIconFrame class="saved-drinks-empty__art" decorative>
		{#if filtered}
			<Search size="1em" />
		{:else}
			<SmoothieCup size="1em" />
		{/if}
	</CircularIconFrame>
	<div class="saved-drinks-empty__copy">
		<h2>{filtered ? "No saved mixes found" : "Save a favorite for next time"}</h2>
		<p>
			{filtered
				? "Try another mix name or ingredient."
				: "Build a mix you love, give it a name, and it will be ready to make again here."}
		</p>
	</div>
	<RoundedActionButton variant={filtered ? "soft" : "primary"} onclick={onAction}>
		{filtered ? "Clear search" : "Build a mix"}
	</RoundedActionButton>
</section>

<style lang="scss">
	@use "./SavedDrinksEmptyState.scss";
</style>
