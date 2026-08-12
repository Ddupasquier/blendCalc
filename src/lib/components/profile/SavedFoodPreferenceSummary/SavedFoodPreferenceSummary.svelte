<script lang="ts">
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import type { SavedFoodPreferenceSummaryProps } from "./types";

	let { items }: SavedFoodPreferenceSummaryProps = $props();
</script>

<CollapsibleSection
	title="Saved preferences"
	badge={items.length ? `${items.length}` : undefined}
	surface="panel"
>
	<div class="saved-food-preference-summary">
		{#if items.length}
			<dl>
				{#each items as item (item.label)}
					<div>
						<dt>{item.label}</dt>
						<dd>{item.value}</dd>
					</div>
				{/each}
			</dl>
		{:else}
			<p>Nothing saved yet.</p>
		{/if}
	</div>
</CollapsibleSection>

<style lang="scss">
	@use "./SavedFoodPreferenceSummary.scss";
</style>
