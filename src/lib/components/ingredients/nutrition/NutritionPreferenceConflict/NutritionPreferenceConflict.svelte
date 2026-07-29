<script lang="ts">
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import {
		createFoodCompatibilityFeedbackRequest,
		type FoodCompatibilityFeedbackResponse,
	} from "$lib/utils/food/quality/compatibilityFeedback";
	import {
		FOOD_PREFERENCE_WARNING_TITLE,
		getFoodPreferenceWarningMessage,
		type FoodPreferenceWarning,
	} from "$lib/utils/profile/foodPreferenceWarnings";
	import type { NutritionPreferenceConflictProps } from "./types";

	let { food }: NutritionPreferenceConflictProps = $props();
	let pendingWarningId = $state<string | null>(null);
	let feedbackStatusByWarning = $state<Record<string, string>>({});

	const preferenceWarnings = $derived(food?.preferenceWarnings ?? []);
	const hasConfirmedPreferenceConflict = $derived(
		preferenceWarnings.some((warning) => warning.level === "warning"),
	);

	const reportWarning = async (warning: FoodPreferenceWarning) => {
		if (!food || pendingWarningId) return;
		pendingWarningId = warning.id;
		feedbackStatusByWarning = {
			...feedbackStatusByWarning,
			[warning.id]: "",
		};

		try {
			const response = await fetch("/api/food-compatibility/feedback", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(
					createFoodCompatibilityFeedbackRequest(food, warning),
				),
			});
			if (!response.ok) throw new Error("feedback request failed");
			const result = await response.json() as FoodCompatibilityFeedbackResponse;
			feedbackStatusByWarning = {
				...feedbackStatusByWarning,
				[warning.id]: result.status === "already_pending"
					? "You already sent this warning for review."
					: "Thanks—we’ll review this warning.",
			};
		} catch {
			feedbackStatusByWarning = {
				...feedbackStatusByWarning,
				[warning.id]: "We couldn’t send this yet. Please try again.",
			};
		} finally {
			pendingWarningId = null;
		}
	};
</script>

{#if preferenceWarnings.length > 0}
	<StatusMessage
		tone={hasConfirmedPreferenceConflict ? "danger" : "warning"}
		iconPlacement="top-end"
		title={FOOD_PREFERENCE_WARNING_TITLE}
	>
		<ul class="preference-conflict__list">
			{#each preferenceWarnings as warning}
				<li>
					<div class="preference-conflict__warning">
						<span>{getFoodPreferenceWarningMessage(warning)}</span>
						<ActionButton
							variant="ghost"
							size="small"
							busy={pendingWarningId === warning.id}
							disabled={Boolean(
								feedbackStatusByWarning[warning.id] &&
								!feedbackStatusByWarning[warning.id].startsWith("We couldn’t"),
							)}
							ariaLabel={`Report an incorrect warning about ${warning.label}`}
							onclick={() => reportWarning(warning)}
						>
							Report
						</ActionButton>
					</div>
					{#if feedbackStatusByWarning[warning.id]}
						<p class="preference-conflict__feedback" aria-live="polite">
							{feedbackStatusByWarning[warning.id]}
						</p>
					{/if}
				</li>
			{/each}
		</ul>
	</StatusMessage>
{/if}

<style lang="scss">
	@use "./NutritionPreferenceConflict.scss";
</style>
