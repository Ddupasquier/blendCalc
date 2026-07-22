<script lang="ts">
	import StatusMessage from "$lib/components/common/feedback/StatusMessage.svelte";
	import { getFoodPreferenceContext } from "$lib/utils/profile/foodPreferenceContext.svelte";
	import { getFoodPreferenceWarnings } from "$lib/utils/profile/foodPreferenceWarnings";
	import type { NutritionPreferenceConflictProps } from "./types";

	let { food }: NutritionPreferenceConflictProps = $props();

	const foodPreferenceContext = getFoodPreferenceContext();
	const preferenceWarnings = $derived(
		food ? getFoodPreferenceWarnings(food, foodPreferenceContext.current) : [],
	);
	const hasConfirmedPreferenceConflict = $derived(
		preferenceWarnings.some((warning) => warning.level === "warning"),
	);
</script>

{#if preferenceWarnings.length > 0}
	<StatusMessage
		tone={hasConfirmedPreferenceConflict ? "danger" : "warning"}
		title={hasConfirmedPreferenceConflict
			? "Potential conflict"
			: "Possible conflict"}
	>
		<ul class="preference-conflict__list">
			{#each preferenceWarnings as warning}
				<li>{warning.reason}</li>
			{/each}
		</ul>
	</StatusMessage>
{/if}

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.preference-conflict__list {
		display: grid;
		gap: $app-gap-xs;
		margin: 0;
		padding-left: $app-gap-lg;
		color: $app-shell-text-primary;
		font-size: $app-font-size-sm;
	}
</style>
