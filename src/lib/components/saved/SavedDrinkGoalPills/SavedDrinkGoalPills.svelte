<script lang="ts">
	import type { SavedDrinkGoalPillsProps } from "./types";

	let { goals }: SavedDrinkGoalPillsProps = $props();
</script>

{#if goals.length > 0}
	<ul class="saved-drink-goals" aria-label="Saved mix goal progress">
		{#each goals as goal (goal.nutrientId)}
			<li data-tone={goal.tone}>
				<span>{goal.label}</span>
				<strong>{goal.percent}%</strong>
			</li>
		{/each}
	</ul>
{/if}

<style lang="scss">
	@use "./SavedDrinkGoalPills.scss";
</style>
