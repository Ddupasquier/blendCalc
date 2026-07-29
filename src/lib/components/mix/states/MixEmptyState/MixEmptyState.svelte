<script lang="ts">
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame/CircularIconFrame.svelte";

	const steps = [
		{
			title: "Search",
			text: "Find ingredients on the Fridge tab.",
		},
		{
			title: "Save",
			text: "Add useful items to your fridge or shopping list.",
		},
		{
			title: "Select",
			text: "Choose ingredient pills here for your combination.",
		},
		{
			title: "Adjust",
			text: "Set amounts and review the graph.",
		},
	];
</script>

<section class="mix-empty-state" aria-label="How to build a food combination">
	<div class="mix-empty-state__intro">
		<p class="mix-empty-state__eyebrow">No ingredients selected yet</p>
		<h4>Build a food combination in four steps.</h4>
		<p>
			Start by adding ingredients to your fridge or shopping list, then select
			them here to calculate goals, warnings, and graph totals.
		</p>
	</div>

	<ol class="mix-empty-state__steps">
		{#each steps as step, index}
			<li>
				<CircularIconFrame class="mix-empty-state__step-number" decorative>
					{index + 1}
				</CircularIconFrame>
				<div>
					<strong>{step.title}</strong>
					<p>{step.text}</p>
				</div>
			</li>
		{/each}
	</ol>

	<div class="mix-empty-state__actions">
		<a href="/fridge">Go to Fridge</a>
		<p>If items are already listed above, click a pill to add it to the mix.</p>
	</div>
</section>

<style lang="scss">
	@use "./MixEmptyState.scss";
</style>
