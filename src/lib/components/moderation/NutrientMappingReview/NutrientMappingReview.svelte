<script lang="ts">
	import { enhance } from "$app/forms";
	import type { SubmitFunction } from "@sveltejs/kit";
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import CompatibleNutrientPicker from "$lib/components/moderation/CompatibleNutrientPicker/CompatibleNutrientPicker.svelte";
	import type { NutrientMappingReviewProps } from "./types";

	let { workspace, form = null }: NutrientMappingReviewProps = $props();
	let pending = $state(false);
	let outcome = $state<"" | "approved" | "excluded">("");
	let selectedNutrientId = $state("");
	let initializedMappingId = $state("");
	let evidenceReference = $state("");
	let reviewNote = $state("");

	$effect(() => {
		if (workspace.mapping.id === initializedMappingId) return;
		initializedMappingId = workspace.mapping.id;
		selectedNutrientId = workspace.compatibleNutrients.some(
			(nutrient) =>
				nutrient.nutrientId === workspace.mapping.currentNutrient.nutrientId,
		)
			? String(workspace.mapping.currentNutrient.nutrientId)
			: "";
		outcome = "";
		evidenceReference = "";
		reviewNote = "";
	});

	const resolved = $derived(
		workspace.mapping.reviewStatus !== "pending_review",
	);
	const confidencePercent = $derived(
		`${Math.round(workspace.mapping.confidence * 100)}%`,
	);
	const currentSuggestionIsCompatible = $derived(
		workspace.compatibleNutrients.some(
			(nutrient) =>
				nutrient.nutrientId === workspace.mapping.currentNutrient.nutrientId,
		),
	);
	const setOutcome = (value: string) => {
		if (value !== "approved" && value !== "excluded") return;
		outcome = value;
		evidenceReference = "";
		reviewNote = "";
	};

	const enhanceDecision: SubmitFunction = ({ cancel }) => {
		if (pending) {
			cancel();
			return;
		}
		pending = true;
		return async ({ update }) => {
			try {
				await update({ reset: false });
			} finally {
				pending = false;
			}
		};
	};
</script>

<section class="nutrient-mapping-review" aria-label="Nutrient mapping review">
	{#if form?.nutrientMappingReviewError}
		<StatusMessage tone="danger" message={form.nutrientMappingReviewError} />
	{:else if form?.nutrientMappingReviewSuccess}
		<StatusMessage tone="success" message={form.nutrientMappingReviewSuccess} />
	{/if}

	<article class="nutrient-mapping-review__summary">
		<header>
			<div>
				<strong
					>{workspace.mapping.sourceNutrientName ??
						workspace.mapping.sourceNutrientKey}</strong
				>
				<span>{workspace.mapping.sourceDisplayName}</span>
			</div>
			<TextBadge
				label={resolved ? "Resolved" : "Needs review"}
				tone={resolved ? "success" : "warning"}
			/>
		</header>
		<dl class="nutrient-mapping-review__facts">
			<div>
				<dt>Provider key</dt>
				<dd>{workspace.mapping.sourceNutrientKey}</dd>
			</div>
			<div>
				<dt>Provider unit</dt>
				<dd>{workspace.mapping.sourceUnitName}</dd>
			</div>
			<div>
				<dt>Suggested nutrient</dt>
				<dd>{workspace.mapping.currentNutrient.nutrientName}</dd>
			</div>
			<div>
				<dt>Suggestion confidence</dt>
				<dd>{confidencePercent}</dd>
			</div>
			<div>
				<dt>Observations</dt>
				<dd>{workspace.mapping.observationCount}</dd>
			</div>
		</dl>
	</article>

	<CollapsibleSection title="Why this needs review" surface="panel">
		<div class="nutrient-mapping-review__explanation">
			{#if workspace.mapping.mappingMethod === "db_reviewed_api_key_match" && !currentSuggestionIsCompatible}
				<p>
					The provider key has an exact reviewed identity, but its reported
					{workspace.mapping.sourceUnitName} unit does not have a reviewed path to
					{workspace.mapping.currentNutrient.defaultUnitName}. It stays disabled
					until that nutrient-specific conversion is reviewed.
				</p>
			{:else}
				<p>
					blendCalc found a possible match, but the provider key is not an exact
					reviewed identity. It stays disabled until evidence confirms what it
					represents.
				</p>
			{/if}
			{#if workspace.mapping.candidateReason}
				<p>{workspace.mapping.candidateReason}</p>
			{/if}
			<p>
				Approving this mapping affects future imports and reprocessing. It does
				not silently rewrite older nutrient records.
			</p>
		</div>
	</CollapsibleSection>

	{#if resolved}
		<StatusMessage
			tone="info"
			title="Review complete"
			message={workspace.mapping.reviewStatus === "approved"
				? "This provider key now has an approved nutrient identity."
				: "This candidate was excluded and remains unavailable to canonical nutrition data."}
		/>
		{#if workspace.latestDecision}
			<CollapsibleSection title="Recorded decision" surface="panel">
				<dl class="nutrient-mapping-review__facts">
					<div>
						<dt>Outcome</dt>
						<dd>{workspace.latestDecision.outcome}</dd>
					</div>
					<div>
						<dt>Review note</dt>
						<dd>{workspace.latestDecision.reviewNote}</dd>
					</div>
					{#if workspace.latestDecision.evidenceReference}
						<div>
							<dt>Evidence</dt>
							<dd>{workspace.latestDecision.evidenceReference}</dd>
						</div>
					{/if}
				</dl>
			</CollapsibleSection>
		{/if}
	{:else}
		<form
			class="nutrient-mapping-review__decision"
			method="POST"
			action="?/reviewNutrientMapping"
			use:enhance={enhanceDecision}
			aria-busy={pending}
		>
			<header class="nutrient-mapping-review__decision-heading">
				<span>Record the outcome</span>
				<h2>Confirm the identity from evidence, not the suggestion</h2>
				<p>
					Approve links this provider key to the confirmed nutrient and enables
					it for future normalized imports. Exclude disables the candidate,
					removes it from this queue, and keeps it out of canonical nutrition
					data.
				</p>
			</header>
			<SelectField
				id="nutrient-mapping-outcome"
				name="outcome"
				label="1. What does the evidence support?"
				value={outcome}
				onValueChange={setOutcome}
				options={[
					{
						value: "",
						label: "Choose a decision",
						disabled: true,
						hidden: true,
						placeholder: true,
					},
					{
						value: "approved",
						label: "Approve — evidence proves an exact identity",
					},
					{
						value: "excluded",
						label: "Exclude — evidence does not prove this match",
					},
				]}
				helper="The suggested nutrient and confidence are clues, not approval evidence."
				disabled={pending}
				required
			/>

			{#if outcome === "approved"}
				{#if !currentSuggestionIsCompatible}
					<StatusMessage
						tone="warning"
						title="The suggested nutrient is not selectable yet"
						message={`There is no reviewed ${workspace.mapping.sourceUnitName}-to-${workspace.mapping.currentNutrient.defaultUnitName} unit path for ${workspace.mapping.currentNutrient.nutrientName}. Choose another compatible nutrient only if the evidence proves it, or change the decision to Exclude.`}
					/>
				{/if}
				<CompatibleNutrientPicker
					nutrients={workspace.compatibleNutrients}
					{selectedNutrientId}
					onValueChange={(value) => (selectedNutrientId = value)}
					disabled={pending}
				/>
				<TextField
					id="nutrient-mapping-evidence-reference"
					name="evidenceReference"
					label="2. Where was the identity confirmed?"
					placeholder="Provider documentation, standard, or reviewed source"
					helper="Record exactly where the nutrient identity was confirmed."
					maxlength={2000}
					disabled={pending}
					oninput={(event) => (evidenceReference = event.currentTarget.value)}
					required
				/>
			{/if}

			{#if outcome}
				<TextField
					id="nutrient-mapping-review-note"
					name="reviewNote"
					label={outcome === "approved"
						? "3. How does the evidence prove this identity?"
						: "2. Why must this candidate remain unavailable?"}
					placeholder={outcome === "approved"
						? "Explain how the provider key, unit, and reference identify the selected nutrient."
						: "Explain the mismatch, ambiguity, or missing evidence."}
					helper="Saved with the private, immutable decision record."
					maxlength={2000}
					multiline
					rows={4}
					disabled={pending}
					oninput={(event) => (reviewNote = event.currentTarget.value)}
					required
				/>

				<ActionButton
					type="submit"
					variant={outcome === "approved" ? "success" : "danger"}
					fullWidth
					busy={pending}
					disabled={pending ||
						!reviewNote.trim() ||
						(outcome === "approved" &&
							(!selectedNutrientId || !evidenceReference.trim()))}
				>
					{outcome === "approved"
						? "Approve nutrient mapping"
						: "Exclude candidate"}
				</ActionButton>
			{/if}
		</form>
	{/if}
</section>

<style lang="scss">
	@use "./NutrientMappingReview.scss";
</style>
