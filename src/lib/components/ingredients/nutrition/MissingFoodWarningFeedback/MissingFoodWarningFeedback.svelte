<script lang="ts">
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import PhotoUploadInput from "$lib/components/common/forms/PhotoUploadInput/PhotoUploadInput.svelte";
	import {
		createUserFacingErrorFromResponse,
		getUserFacingErrorMessage,
	} from "$lib/utils/errors/userFacingErrors";
	import type { FoodCompatibilityFeedbackResponse } from "$lib/utils/food/quality/compatibilityFeedback";
	import type { MissingFoodWarningFeedbackProps } from "./types";

	let { food }: MissingFoodWarningFeedbackProps = $props();
	let selectedPreferenceKey = $state("");
	let observedLabelDate = $state("");
	let reportDetails = $state("");
	let evidenceFiles = $state<File[]>([]);
	let submitting = $state(false);
	let status = $state<"idle" | "success" | "error">("idle");
	let statusMessage = $state("");

	const reportablePreferences = $derived.by(() => {
		const unique = new Map<string, NonNullable<
			typeof food.compatibilityEvaluation
		>["preferenceResolution"]["resolvedPreferences"][number]>();
		for (
			const preference of food.compatibilityEvaluation?.preferenceResolution
				.resolvedPreferences ?? []
		) {
			const key = `${preference.tagId}:${preference.type}`;
			if (!unique.has(key)) unique.set(key, preference);
		}
		return [...unique.values()];
	});
	const selectedPreference = $derived(
		reportablePreferences.find((preference) =>
			`${preference.tagId}:${preference.type}` === selectedPreferenceKey
		) ?? null,
	);
	const sourceId = $derived(String(
		food.sourceIdentifiers?.[food.sourceKey ?? ""] ?? food.fdcId,
	));
	const maximumObservedDate = new Date().toISOString().slice(0, 10);

	$effect(() => {
		if (!selectedPreferenceKey && reportablePreferences[0]) {
			selectedPreferenceKey = `${reportablePreferences[0].tagId}:${reportablePreferences[0].type}`;
		}
	});

	const submitFeedback = async (event: SubmitEvent) => {
		event.preventDefault();
		if (!selectedPreference || submitting) return;
		submitting = true;
		status = "idle";
		statusMessage = "";

		const formData = new FormData();
		if (food.sharedProductId) formData.set("sharedProductId", food.sharedProductId);
		if (food.sourceKey) formData.set("sourceKey", food.sourceKey);
		formData.set("sourceId", sourceId);
		if (food.barcode ?? food.gtinUpc) {
			formData.set("barcode", food.barcode ?? food.gtinUpc ?? "");
		}
		formData.set(
			"foodDescription",
			food.canonicalDescription ?? food.description,
		);
		formData.set("preferenceTagId", selectedPreference.tagId);
		formData.set("preferenceType", selectedPreference.type);
		if (observedLabelDate) {
			formData.set("observedLabelDate", observedLabelDate);
		}
		formData.set("reportDetails", reportDetails);
		if (evidenceFiles[0]) formData.set("evidence", evidenceFiles[0]);

		try {
			const response = await fetch("/api/food-compatibility/missing-warning", {
				method: "POST",
				body: formData,
			});
			if (!response.ok) {
				throw await createUserFacingErrorFromResponse(
					response,
					"SERVICE_UNAVAILABLE",
				);
			}
			const result = await response.json() as FoodCompatibilityFeedbackResponse;
			status = "success";
			statusMessage = result.status === "already_pending"
				? "You already sent this food and setting for review."
				: "Thanks. We’ll compare this with the current package and product record.";
		} catch (error) {
			status = "error";
			statusMessage = getUserFacingErrorMessage(error, {
				fallback: "We couldn’t send this report yet. Please try again.",
				network: "We couldn’t connect right now. Check your connection and try again.",
			});
		} finally {
			submitting = false;
		}
	};
</script>

{#if reportablePreferences.length > 0}
	<div class="missing-warning-feedback">
		<CollapsibleSection title="Missing a food warning?" surface="panel">
			<form onsubmit={submitFeedback}>
				<p class="missing-warning-feedback__intro">
					If this food conflicts with one of your settings but no warning appeared,
					tell us what the current package shows.
				</p>

				<label class="missing-warning-feedback__field">
					<span>Affected setting</span>
					<select bind:value={selectedPreferenceKey} required disabled={submitting}>
						{#each reportablePreferences as preference}
							<option value={`${preference.tagId}:${preference.type}`}>
								{preference.rawValue}
							</option>
						{/each}
					</select>
				</label>

				<label class="missing-warning-feedback__field">
					<span>When did you check this package? <small>optional</small></span>
					<input
						type="date"
						bind:value={observedLabelDate}
						max={maximumObservedDate}
						disabled={submitting}
					/>
				</label>

				<label class="missing-warning-feedback__field">
					<span>What should we check?</span>
					<textarea
						bind:value={reportDetails}
						minlength="10"
						maxlength="1000"
						required
						disabled={submitting}
						placeholder="For example: The current ingredients list includes milk, but I did not see a dairy warning."
					></textarea>
				</label>

				<PhotoUploadInput
					id={`missing-warning-evidence-${food.fdcId}`}
					name="missing-warning-evidence"
					prompt="Current package label"
					description="A clear ingredients or allergen photo helps moderators compare the exact package."
					files={evidenceFiles}
					disabled={submitting}
					onFilesChange={(files) => evidenceFiles = [...files]}
				/>

				<p class="missing-warning-feedback__note">
					Your report stays private and does not change warnings immediately.
					Keep checking the current package label.
				</p>

				{#if status !== "idle"}
					<StatusMessage
						tone={status === "success" ? "success" : "danger"}
						message={statusMessage}
					/>
				{/if}

				<ActionButton
					type="submit"
					fullWidth
					busy={submitting}
					disabled={status === "success" || !selectedPreference}
				>
					Send for review
				</ActionButton>
			</form>
		</CollapsibleSection>
	</div>
{/if}

<style lang="scss">
	@use "./MissingFoodWarningFeedback.scss";
</style>
