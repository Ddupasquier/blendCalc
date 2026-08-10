<script lang="ts">
	import type { SavedFoodPreferenceSummaryProps } from "./types";

	let { items }: SavedFoodPreferenceSummaryProps = $props();
</script>

{#if items.length}
	<section class="saved-food-preference-summary" aria-labelledby="saved-food-preference-summary-title">
		<h3 id="saved-food-preference-summary-title">Currently saved</h3>
		<dl>
			{#each items as item (item.label)}
				<div>
					<dt>{item.label}</dt>
					<dd>{item.value}</dd>
				</div>
			{/each}
		</dl>
	</section>
{/if}

<style lang="scss">
	@use "./SavedFoodPreferenceSummary.scss";
</style>
