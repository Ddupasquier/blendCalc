<script lang="ts">
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import { getFoodPreferenceContext } from "$lib/utils/profile/foodPreferenceContext.svelte";
	import {
		FOOD_PREFERENCE_WARNING_TITLE,
		getFoodPreferenceWarningMessage,
		getFoodPreferenceWarnings,
	} from "$lib/utils/profile/foodPreferenceWarnings";
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
		iconPlacement="top-end"
		title={FOOD_PREFERENCE_WARNING_TITLE}
	>
		<ul class="preference-conflict__list">
			{#each preferenceWarnings as warning}
				<li>{getFoodPreferenceWarningMessage(warning)}</li>
			{/each}
		</ul>
	</StatusMessage>
{/if}

<style lang="scss">
	@use "./NutritionPreferenceConflict.scss";
</style>
