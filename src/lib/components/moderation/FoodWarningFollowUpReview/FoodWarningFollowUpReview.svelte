<script lang="ts">
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import { getCatalogResponsibleGroupLabel } from "$lib/utils/moderation/catalogHealthMessages";
	import {
		getAppIssueMessage,
		isAppIssueCode,
		normalizeAppIssueParams,
	} from "$lib/utils/errors/appIssues";
	import type { FoodWarningFollowUpReviewProps } from "./types";

	let { reviewCase, canResolve }: FoodWarningFollowUpReviewProps = $props();
	let outcome = $state("");
	let note = $state("");
	const isTerminal = $derived(
		reviewCase.status === "resolved" || reviewCase.status === "dismissed",
	);
	const formatReadableLabel = (value: string) =>
		value
			.replaceAll("_", " ")
			.replace(/^./u, (letter) => letter.toLocaleUpperCase());
	const formatDateTime = (value: string | null) =>
		value
			? new Intl.DateTimeFormat(undefined, {
					dateStyle: "medium",
					timeStyle: "short",
				}).format(new Date(value))
			: "Not recorded";
	const statusLabels: Record<string, string> = {
		open: "Open",
		deferred: "Deferred",
		resolved: "Resolved",
		dismissed: "Dismissed",
	};
	const evidenceSourceLabels: Record<string, string> = {
		label_allergen_field: "Package allergen statement",
		label_trace_field: "Package may-contain statement",
		label_dietary_field: "Package dietary statement",
		label_ingredient_field: "Package ingredient list",
		food_identity_taxonomy: "Reviewed food identity",
		source_dietary_analysis: "Source ingredient analysis",
		shared_product_metadata: "Shared product data",
		shared_observation_metadata: "Stored source observation",
		shared_submission_metadata: "Reviewed submission evidence",
	};
	const resolutionActionLabels: Record<string, string> = {
		rule_review: "Review warning policy",
		source_correction: "Correct source mapping",
		product_correction: "Correct product data",
		duplicate: "Close as duplicate",
		none: "No separate follow-up",
	};

	const outcomeExplanation = $derived(
		outcome === "resolved"
			? "Resolve closes this follow-up because reviewed evidence—or a separately applied change—now addresses it. This form does not edit warning rules, source mappings, or product data."
			: outcome === "dismissed"
				? "Dismiss closes this follow-up as not requiring a policy or source change. The original report and this note remain in the audit history."
				: outcome === "deferred"
					? "Defer keeps the follow-up in the work list and records the prerequisite that is still missing."
					: "Resolve or dismiss removes this item from follow-up work. Defer keeps it open. None of these choices silently changes product, source, or policy data.",
	);
	const reasonLabel = $derived(formatReadableLabel(reviewCase.reportReason));
	const warningExplanation = $derived(
		reviewCase.feedbackType === "missing_warning"
			? `No ${reviewCase.preferenceValue ?? "matching"} warning was shown when the report was created.`
			: reviewCase.issueCode && isAppIssueCode(reviewCase.issueCode)
				? getAppIssueMessage(
						reviewCase.issueCode,
						normalizeAppIssueParams(reviewCase.issueParams),
					)
				: reviewCase.issueCode
					? `Recorded warning code: ${reviewCase.issueCode}`
					: "No warning was recorded when this report was created.",
	);
</script>

<div class="food-warning-follow-up-review">
	<section aria-labelledby="follow-up-evidence-title">
		<header>
			<div>
				<h2 id="follow-up-evidence-title">Captured report and evidence</h2>
				<p>Review these facts before recording an outcome.</p>
			</div>
			<TextBadge
				label={statusLabels[reviewCase.status] ??
					formatReadableLabel(reviewCase.status)}
				tone={isTerminal ? "success" : "warning"}
			/>
		</header>
		<dl>
			<div>
				<dt>Food</dt>
				<dd>{reviewCase.productName}</dd>
			</div>
			<div>
				<dt>Barcode</dt>
				<dd>{reviewCase.barcode ?? "Not recorded"}</dd>
			</div>
			<div>
				<dt>Report reason</dt>
				<dd>{reasonLabel}</dd>
			</div>
			<div>
				<dt>
					{reviewCase.feedbackType === "missing_warning"
						? "Warning missing at report time"
						: "Warning shown to the user"}
				</dt>
				<dd>{warningExplanation}</dd>
			</div>
			<div>
				<dt>Stored evidence facts</dt>
				<dd>{reviewCase.facts.length}</dd>
			</div>
			<div>
				<dt>Policy version</dt>
				<dd>{reviewCase.policyVersion ?? "Not recorded"}</dd>
			</div>
			<div>
				<dt>Source</dt>
				<dd>{reviewCase.sourceKey ?? "Not recorded"}</dd>
			</div>
			<div>
				<dt>Owner</dt>
				<dd>{getCatalogResponsibleGroupLabel(reviewCase.responsibleGroup)}</dd>
			</div>
		</dl>
		{#if reviewCase.reportDetails}<p
				class="food-warning-follow-up-review__report-note"
			>
				<strong>Reporter note</strong>
				{reviewCase.reportDetails}
			</p>{/if}

		<div class="food-warning-follow-up-review__initial-review">
			<strong>Initial report decision</strong>
			<dl>
				<div>
					<dt>Decision</dt>
					<dd>{formatReadableLabel(reviewCase.initialReviewStatus)}</dd>
				</div>
				<div>
					<dt>Follow-up selected</dt>
					<dd>
						{resolutionActionLabels[reviewCase.initialResolutionAction] ??
							formatReadableLabel(reviewCase.initialResolutionAction)}
					</dd>
				</div>
				<div>
					<dt>Reviewed</dt>
					<dd>{formatDateTime(reviewCase.initialReviewedAt)}</dd>
				</div>
			</dl>
			<p>
				<strong>Reviewer’s evidence note</strong>
				{reviewCase.initialReviewNote ?? "No initial review note was recorded."}
			</p>
		</div>

		<div class="food-warning-follow-up-review__evidence-snapshot">
			<strong>Evidence snapshot used for the report</strong>
			{#if reviewCase.facts.length > 0}
				<ul>
					{#each reviewCase.facts as fact}
						<li>
							<strong>{formatReadableLabel(fact.factType)}: {fact.label}</strong
							>
							<span>
								{evidenceSourceLabels[fact.sourceType] ??
									formatReadableLabel(fact.sourceType)}{fact.sourceText
									? ` — “${fact.sourceText}”`
									: ""}. Confidence: {formatReadableLabel(fact.confidence)}.
							</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p>
					No matching fact was captured with the report. Do not infer that the
					food is safe or that a correction is complete.
				</p>
			{/if}
		</div>

		{#if reviewCase.resolutionNote}<p
				class="food-warning-follow-up-review__report-note"
			>
				<strong>Previous follow-up note</strong>
				{reviewCase.resolutionNote}
			</p>{/if}
	</section>

	<section aria-labelledby="follow-up-decision-title">
		<header>
			<div>
				<span>Record the outcome</span>
				<h2 id="follow-up-decision-title">
					{isTerminal
						? "Completion record"
						: reviewCase.caseType === "rule_review"
							? "Finish the warning-rule review"
							: "Finish the source-correction review"}
				</h2>
			</div>
		</header>
		{#if isTerminal}
			<div class="food-warning-follow-up-review__complete">
				<strong>This follow-up is finished</strong>
				<p>
					It is no longer in the warning work list. The report, evidence, and
					private outcome note remain available here for audit history. This
					record did not silently change product, source, or policy data.
				</p>
			</div>
		{:else if canResolve}
			<form method="POST" action="?/resolveFollowUp">
				<input type="hidden" name="caseId" value={reviewCase.id} />
				<SelectField
					id="food-warning-follow-up-outcome"
					name="outcome"
					label="1. What did the evidence establish?"
					value={outcome}
					onValueChange={(value) => (outcome = value)}
					options={[
						{
							value: "",
							label: "Choose an outcome",
							disabled: true,
							hidden: true,
							placeholder: true,
						},
						{
							value: "resolved",
							label: "Resolved — evidence or an applied change addresses it",
						},
						{
							value: "dismissed",
							label: "Dismiss — no policy or source change is required",
						},
						{
							value: "deferred",
							label: "Defer — a named prerequisite is still missing",
						},
					]}
					helper={outcomeExplanation}
					required
				/>
				<TextField
					id="food-warning-follow-up-note"
					name="resolutionNote"
					label="2. What evidence supports this outcome?"
					placeholder={outcome === "deferred"
						? "Name the missing source, policy decision, or other prerequisite."
						: "Name the reviewed source and why it resolves or dismisses the case."}
					helper="This note is retained with the private follow-up audit record."
					maxlength={2000}
					multiline
					rows={4}
					oninput={(event) => (note = event.currentTarget.value)}
					required
				/>
				<ActionButton
					type="submit"
					variant={outcome === "dismissed" ? "danger" : "success"}
					disabled={!outcome || !note.trim()}
				>
					{outcome === "resolved"
						? "Resolve follow-up"
						: outcome === "dismissed"
							? "Dismiss follow-up"
							: outcome === "deferred"
								? "Defer with prerequisite"
								: "Save outcome"}
				</ActionButton>
			</form>
		{:else}
			<div class="food-warning-follow-up-review__unavailable">
				<strong>This action needs a Data operations reviewer</strong>
				<p>
					You can inspect the captured report, but source corrections require
					the Data operations repair permission. Nothing changes until an
					authorized reviewer records the outcome.
				</p>
			</div>
		{/if}
	</section>
</div>

<style lang="scss">
	@use "./FoodWarningFollowUpReview.scss";
</style>
