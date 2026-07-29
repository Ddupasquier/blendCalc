<script lang="ts">
	import MetadataPill from "$lib/components/common/display/MetadataPill/MetadataPill.svelte";
	import type { SavedDrinkGoalPillsProps } from "./types";

	let { goals }: SavedDrinkGoalPillsProps = $props();
</script>

{#if goals.length > 0}
	<ul class="saved-drink-goals" aria-label="Saved mix goal progress">
		{#each goals as goal (goal.nutrientId)}
			<li>
				<MetadataPill
					label={goal.label}
					value={`${goal.percent}%`}
					tone={goal.tone}
				/>
			</li>
		{/each}
	</ul>
{/if}

<style lang="scss">
	@use "./SavedDrinkGoalPills.scss";
</style>
