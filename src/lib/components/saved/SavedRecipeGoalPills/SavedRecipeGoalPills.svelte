<script lang="ts">
	import MetadataPill from "$lib/components/common/display/MetadataPill/MetadataPill.svelte";
	import type { SavedRecipeGoalPillsProps } from "./types";

	let { goals }: SavedRecipeGoalPillsProps = $props();
</script>

{#if goals.length > 0}
	<ul class="saved-recipe-goals" aria-label="Saved recipe goal progress">
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
	@use "./SavedRecipeGoalPills.scss";
</style>
