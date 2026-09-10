<script lang="ts">
	import { enhance } from "$app/forms";
	import type { SubmitFunction } from "@sveltejs/kit";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import ModeratorReviewCard from "$lib/components/moderation/ModeratorReviewCard/ModeratorReviewCard.svelte";
	import ModeratorReviewList from "$lib/components/moderation/ModeratorReviewList/ModeratorReviewList.svelte";
	import {
		getAppIssueMessage,
		isAppIssueCode,
		normalizeAppIssueParams,
	} from "$lib/utils/errors/appIssues";
	import type {
		FoodWarningReport,
		FoodWarningReportReviewListProps,
		StoredWarningFact,
	} from "./types";

	let {
		reports,
		form = null,
		showHeading = false,
	}: FoodWarningReportReviewListProps = $props();
	let pendingReportId = $state<string | null>(null);
	let decisions = $state<
		Record<
			string,
			{
				status: "" | "confirmed" | "dismissed";
				resolutionAction: string;
				reviewNote: string;
			}
		>
	>({});

	const formatReadableLabel = (value: string) =>
		value
			.replaceAll("_", " ")
			.replace(/^./u, (letter) => letter.toLocaleUpperCase());

	const readStoredFacts = (snapshot: unknown): StoredWarningFact[] => {
		if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
			return [];
		}
		const facts = (snapshot as { facts?: unknown }).facts;
		if (!Array.isArray(facts)) return [];
		return facts.flatMap((fact) => {
			if (!fact || typeof fact !== "object" || Array.isArray(fact)) return [];
			const candidate = fact as Record<string, unknown>;
			if (
				typeof candidate.label !== "string" ||
				typeof candidate.factType !== "string" ||
				typeof candidate.sourceType !== "string" ||
				typeof candidate.confidence !== "string"
			) {
				return [];
			}
			return [
				{
					label: candidate.label,
					factType: candidate.factType,
					sourceType: candidate.sourceType,
					sourceText:
						typeof candidate.sourceText === "string"
							? candidate.sourceText
							: null,
					confidence: candidate.confidence,
				},
			];
		});
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

	const getReportClaim = (report: FoodWarningReport) =>
		report.feedbackType === "missing_warning"
			? `The user expected a ${report.preferenceValue ?? "food-preference"} warning, but blendCalc did not show one.`
			: "The user says the warning blendCalc showed is not supported for this food.";

	const reportReasonDescriptions: Record<string, string> = {
		incorrect_match: "They believe the warning does not match this food.",
		outdated_source_data:
			"They believe the product or source information is out of date.",
		wrong_evidence_type:
			"They believe blendCalc used the wrong kind of evidence for this warning.",
		missing_warning: "They believe a relevant warning is missing.",
		other: "They reported another warning problem.",
	};

	const getCurrentWarningExplanation = (report: FoodWarningReport) => {
		if (report.feedbackType === "missing_warning") {
			return `No ${report.preferenceValue ?? "matching"} warning was active when this report was created.`;
		}
		return isAppIssueCode(report.issueCode)
			? getAppIssueMessage(
					report.issueCode,
					normalizeAppIssueParams(report.issueParams),
				)
			: "The original warning explanation was not recorded. Review the stored facts before deciding.";
	};

	const getDecision = (reportId: string) =>
		decisions[reportId] ?? {
			status: "" as const,
			resolutionAction: "",
			reviewNote: "",
		};

	const setDecisionStatus = (
		reportId: string,
		status: "confirmed" | "dismissed",
	) => {
		decisions = {
			...decisions,
			[reportId]: {
				...getDecision(reportId),
				status,
				resolutionAction: "",
			},
		};
	};

	const setResolutionAction = (reportId: string, resolutionAction: string) => {
		decisions = {
			...decisions,
			[reportId]: { ...getDecision(reportId), resolutionAction },
		};
	};

	const setReviewNote = (reportId: string, reviewNote: string) => {
		decisions = {
			...decisions,
			[reportId]: { ...getDecision(reportId), reviewNote },
		};
	};

	const getResolutionOptions = (status: "" | "confirmed" | "dismissed") => [
		{
			value: "",
			label:
				status === ""
					? "Choose the report decision first"
					: "Choose what should happen next",
			disabled: true,
			hidden: true,
			placeholder: true,
		},
		...(status === "dismissed"
			? [
					{
						value: "none",
						label: "No follow-up — current warning is supported",
					},
					{
						value: "duplicate",
						label: "Close as duplicate — work is already tracked",
					},
				]
			: [
					{
						value: "rule_review",
						label: "Review warning policy — the rule may be wrong",
					},
					{
						value: "source_correction",
						label: "Correct source mapping — imported evidence is wrong",
					},
					{
						value: "product_correction",
						label: "Correct product data — stored food facts are wrong",
					},
					{
						value: "duplicate",
						label: "Close as duplicate — work is already tracked",
					},
					{
						value: "none",
						label: "No follow-up — the issue was already resolved",
					},
				]),
	];

	const enhanceWarningDecision: SubmitFunction = ({ formData, cancel }) => {
		if (pendingReportId) {
			cancel();
			return;
		}

		pendingReportId = String(formData.get("feedbackId") ?? "");
		return async ({ update }) => {
			try {
				await update({ reset: false });
			} finally {
				pendingReportId = null;
			}
		};
	};
</script>

<section
	class="food-warning-report-review"
	aria-labelledby={showHeading ? "food-warning-report-review-title" : undefined}
	aria-label={showHeading ? undefined : "Food warning reports"}
>
	{#if showHeading}
		<header class="food-warning-report-review__heading">
			<h2 id="food-warning-report-review-title">Food warning reports</h2>
			<p>Review reports about warnings that may be missing or incorrect.</p>
		</header>
	{/if}

	{#if form?.compatibilityReviewError}
		<StatusMessage tone="danger" message={form.compatibilityReviewError} />
	{:else if form?.compatibilityReviewSuccess}
		<StatusMessage tone="success" message={form.compatibilityReviewSuccess} />
	{/if}

	<ModeratorReviewList
		label="Food warning report review queue"
		itemCount={reports.length}
		singularItemLabel="report waiting for review"
		pluralItemLabel="reports waiting for review"
		emptyTitle="No food warning reports need review"
		emptyDescription="New reports about missing or incorrect warnings will appear here."
	>
		{#each reports as report (report.id)}
			{@const storedFacts = readStoredFacts(report.factSnapshot)}
			{@const decision = getDecision(report.id)}
			<ModeratorReviewCard
				title={report.foodDescription}
				subtitle={`${report.feedbackType === "missing_warning" ? "Missing warning" : "Incorrect warning"} · Policy ${report.policyVersion ? `v${report.policyVersion}` : "version unavailable"}`}
			>
				{#snippet status()}<TextBadge
						label="Needs review"
						tone="warning"
					/>{/snippet}

				<div class="food-warning-report-review__review-brief">
					<div>
						<span>User’s report</span>
						<strong>{getReportClaim(report)}</strong>
						<p>
							{reportReasonDescriptions[report.reportReason] ??
								"The report did not include a categorized reason."}
						</p>
					</div>
					<div>
						<span>Why blendCalc behaved this way</span>
						<strong>{getCurrentWarningExplanation(report)}</strong>
						<p>
							{storedFacts.length > 0
								? `${storedFacts.length} stored ${storedFacts.length === 1 ? "fact was" : "facts were"} used. Review ${storedFacts.length === 1 ? "it" : "them"} below before deciding.`
								: "No matching fact was captured with this report. Do not assume the food is safe; inspect the available package and source evidence."}
						</p>
					</div>
				</div>

				<dl
					class="food-warning-report-review__facts food-warning-report-review__report-facts"
				>
					{#if report.feedbackType === "missing_warning"}
						<div>
							<dt>Affected setting</dt>
							<dd>{report.preferenceValue ?? "Not recorded"}</dd>
						</div>
						<div>
							<dt>Setting type</dt>
							<dd>
								{report.preferenceType
									? formatReadableLabel(report.preferenceType)
									: "Not recorded"}
							</dd>
						</div>
					{:else}
						<div>
							<dt>Reported warning</dt>
							<dd>
								{report.issueCode
									? formatReadableLabel(report.issueCode)
									: "Not recorded"}
							</dd>
						</div>
					{/if}
				</dl>

				{#if report.reportDetails}
					<div class="food-warning-report-review__report-note">
						<strong>User explanation</strong>
						<p>{report.reportDetails}</p>
					</div>
				{/if}

				<CollapsibleSection title="Evidence to compare" surface="panel" open>
					<div class="food-warning-report-review__evidence">
						{#if storedFacts.length > 0}
							<div class="food-warning-report-review__stored-facts">
								<strong>Evidence currently used by blendCalc</strong>
								<ul>
									{#each storedFacts as fact}
										<li>
											<strong
												>{formatReadableLabel(fact.factType)}: {fact.label}</strong
											>
											<span>
												{evidenceSourceLabels[fact.sourceType] ??
													formatReadableLabel(fact.sourceType)}{fact.sourceText
													? ` — “${fact.sourceText}”`
													: ""}. Confidence: {formatReadableLabel(
													fact.confidence,
												)}.
											</span>
										</li>
									{/each}
								</ul>
							</div>
						{:else}
							<p class="food-warning-report-review__missing-evidence">
								No stored matching facts accompanied this report. Use the
								package evidence when available, then choose a correction path
								only when the evidence supports it.
							</p>
						{/if}
						{#if report.evidenceUrl}
							<a
								href={report.evidenceUrl}
								target="_blank"
								rel="noopener noreferrer"
							>
								Open the user’s package-label evidence
							</a>
						{/if}
						<CollapsibleSection
							title="Technical record details"
							surface="panel"
						>
							<dl class="food-warning-report-review__facts">
								<div>
									<dt>Food source</dt>
									<dd>{report.sourceKey ?? "Shared catalog"}</dd>
								</div>
								<div>
									<dt>Source record</dt>
									<dd>{report.sourceId}</dd>
								</div>
								{#if report.barcode}<div>
										<dt>Barcode</dt>
										<dd>{report.barcode}</dd>
									</div>{/if}
								{#if report.sharedProductRevisionId}<div>
										<dt>Catalog revision</dt>
										<dd>{report.sharedProductRevisionId}</dd>
									</div>{/if}
								{#if report.observedLabelDate}<div>
										<dt>Package checked</dt>
										<dd>{report.observedLabelDate}</dd>
									</div>{/if}
							</dl>
							<pre>{JSON.stringify(
									{
										issueParams: report.issueParams,
										facts: report.factSnapshot,
									},
									null,
									2,
								)}</pre>
						</CollapsibleSection>
					</div>
				</CollapsibleSection>

				<form
					class="food-warning-report-review__decision"
					method="POST"
					action="?/reviewCompatibilityFeedback"
					use:enhance={enhanceWarningDecision}
					aria-busy={pendingReportId === report.id}
				>
					<input type="hidden" name="feedbackId" value={report.id} />
					<header class="food-warning-report-review__decision-heading">
						<span>Record the outcome</span>
						<h3>Finish this review in three steps</h3>
						<ol>
							<li>Decide whether the user’s report is supported.</li>
							<li>Route any required correction to the team that owns it.</li>
							<li>
								Write what evidence you checked so the decision is auditable.
							</li>
						</ol>
					</header>
					<SelectField
						id={`compatibility-outcome-${report.id}`}
						name="status"
						label="1. Is the user’s report supported?"
						value={decision.status}
						options={[
							{
								value: "",
								label: "Choose a decision",
								disabled: true,
								hidden: true,
								placeholder: true,
							},
							{
								value: "confirmed",
								label:
									report.feedbackType === "missing_warning"
										? "Yes — blendCalc missed this warning"
										: "Yes — the current warning is not supported",
							},
							{
								value: "dismissed",
								label:
									report.feedbackType === "missing_warning"
										? "No — current warning coverage is correct"
										: "No — the current warning is supported",
							},
						]}
						helper={decision.status === "confirmed"
							? "Yes closes the report as supported and can create the correction work selected below. It does not change live product data or policy by itself."
							: decision.status === "dismissed"
								? "No closes the report as unsupported or duplicate, creates no new correction work, and leaves current warning behavior unchanged."
								: "Yes confirms the report and can create follow-up work. No dismisses it and preserves the current warning behavior."}
						onValueChange={(value) =>
							setDecisionStatus(report.id, value as "confirmed" | "dismissed")}
						disabled={pendingReportId !== null}
						required
					/>
					<SelectField
						id={`compatibility-action-${report.id}`}
						name="resolutionAction"
						label="2. What should happen next?"
						value={decision.resolutionAction}
						options={getResolutionOptions(decision.status)}
						helper={decision.status
							? "This creates or closes the named follow-up; it does not silently change product data or policy."
							: "Choose the report decision first. The valid follow-up choices will then appear."}
						onValueChange={(value) => setResolutionAction(report.id, value)}
						disabled={pendingReportId !== null || !decision.status}
						required
					/>
					<TextField
						id={`compatibility-review-note-${report.id}`}
						name="reviewNote"
						label="3. What evidence supports this decision?"
						placeholder="Example: Package allergen statement lists soy; current warning is supported."
						helper="Name the package, source, policy, or stored fact you checked. This note is saved privately."
						maxlength={2000}
						multiline
						rows={3}
						oninput={(event) =>
							setReviewNote(report.id, event.currentTarget.value)}
						disabled={pendingReportId !== null}
						required
					/>
					<ActionButton
						type="submit"
						fullWidth
						busy={pendingReportId === report.id}
						disabled={pendingReportId !== null ||
							!decision.status ||
							!decision.resolutionAction ||
							!decision.reviewNote.trim()}
						>{decision.status === "confirmed"
							? [
									"rule_review",
									"source_correction",
									"product_correction",
								].includes(decision.resolutionAction)
								? "Confirm report and create follow-up"
								: "Confirm and close report"
							: decision.status === "dismissed"
								? "Dismiss and close report"
								: "Save review"}</ActionButton
					>
				</form>
			</ModeratorReviewCard>
		{/each}
	</ModeratorReviewList>
</section>

<style lang="scss">
	@use "./FoodWarningReportReviewList.scss";
</style>
