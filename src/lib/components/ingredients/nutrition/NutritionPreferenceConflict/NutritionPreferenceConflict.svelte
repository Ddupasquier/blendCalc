<script lang="ts">
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import {
		createFoodCompatibilityFeedbackRequest,
		type FoodCompatibilityFeedbackResponse,
	} from "$lib/utils/food/quality/compatibilityFeedback";
	import {
		FOOD_PREFERENCE_WARNING_TITLE,
		getFoodPreferenceWarningEvidenceMessage,
		getFoodPreferenceWarningEvidenceReviewMessage,
		getFoodPreferenceWarningMessage,
		type FoodPreferenceWarning,
	} from "$lib/utils/profile/foodPreferenceWarnings";
	import type { NutritionPreferenceConflictProps } from "./types";

	let { food, mode = "all" }: NutritionPreferenceConflictProps = $props();
	const showSummary = $derived(mode !== "details");
	const showDetails = $derived(mode !== "summary");
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
	<div class="nutrition-preference-conflict">
		{#if showSummary}
			<StatusMessage
				tone={hasConfirmedPreferenceConflict ? "danger" : "warning"}
				iconPlacement="top-end"
				title={FOOD_PREFERENCE_WARNING_TITLE}
			>
				<ul class="preference-conflict__summary-list">
					{#each preferenceWarnings as warning}
						<li>{getFoodPreferenceWarningMessage(warning)}</li>
					{/each}
				</ul>
			</StatusMessage>
		{/if}

		{#if showDetails}
			<CollapsibleSection
				title="Review these warnings"
				surface="panel"
				class="preference-conflict__details"
			>
				<ul class="preference-conflict__detail-list">
					{#each preferenceWarnings as warning}
						<li class="preference-conflict__item">
							<div class="preference-conflict__evidence">
								<strong>{warning.label}</strong>
								{#if warning.evidence}
									<p>{getFoodPreferenceWarningEvidenceMessage(warning)}</p>
									<p>{getFoodPreferenceWarningEvidenceReviewMessage(warning)}</p>
								{:else}
									<p>{getFoodPreferenceWarningMessage(warning)}</p>
								{/if}
							</div>
							<div class="preference-conflict__action">
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
			</CollapsibleSection>
		{/if}
	</div>
{/if}

<style lang="scss">
	@use "./NutritionPreferenceConflict.scss";
</style>
