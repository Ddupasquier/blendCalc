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
	const formatList = (values: string[]) => {
		if (values.length === 1) return values[0];
		if (values.length === 2) return `both ${values[0]} and ${values[1]}`;
		return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
	};
	const getEvidenceSummary = (facts: StoredWarningFact[]) => {
		if (facts.length === 0) {
			return "No matching evidence was captured with this report. Check the package or source record before deciding.";
		}

		const factsByLabel: Array<{
			label: string;
			facts: StoredWarningFact[];
		}> = [];
		for (const fact of facts) {
			const existingGroup = factsByLabel.find(
				(group) => group.label === fact.label,
			);
			if (existingGroup) existingGroup.facts.push(fact);
			else factsByLabel.push({ label: fact.label, facts: [fact] });
		}

		return factsByLabel
			.map(({ label, facts: matchingFacts }) => {
				const sources = [
					...new Set(
						matchingFacts.map((fact) =>
							(
								evidenceSourceLabels[fact.sourceType] ??
								formatReadableLabel(fact.sourceType)
							).toLocaleLowerCase(),
						),
					),
				].map((source) => `the ${source}`);
				const confidence = matchingFacts.every(
					(fact) => fact.confidence === "confirmed",
				)
					? "is confirmed by"
					: "is supported by";
				return `${label} ${confidence} ${formatList(sources)}.`;
			})
			.join(" ");
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
				resolutionAction: status === "dismissed" ? "none" : "",
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

	const getResolutionOptions = () => [
		{
			value: "",
			label: "Choose what should happen next",
			disabled: true,
			hidden: true,
			placeholder: true,
		},
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
	];

	const getResolutionExplanation = (resolutionAction: string) => {
		switch (resolutionAction) {
			case "rule_review":
				return "Saving creates one open warning-policy review owned by the Food warning policy team. It does not edit or activate a policy.";
			case "source_correction":
				return "Saving creates one open source-correction review owned by Data operations. It does not overwrite imported or catalog evidence.";
			case "product_correction":
				return "Saving creates one catalog-correction starting point for this product. Product data changes only if a separate correction submission is approved.";
			case "duplicate":
				return "Saving closes this report as work already tracked. It creates no new follow-up and leaves current warning behavior unchanged.";
			case "none":
				return "Saving confirms and closes this report because no further work remains. It creates no follow-up and changes no live data.";
			default:
				return "Choose the exact follow-up or closeout that the reviewed evidence supports.";
		}
	};

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
			{@const evidenceSummary = getEvidenceSummary(storedFacts)}
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
						<p>{evidenceSummary}</p>
					</div>
				</div>

				{#if report.feedbackType === "missing_warning"}
					<dl
						class="food-warning-report-review__facts food-warning-report-review__report-facts"
					>
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
					</dl>
				{/if}

				{#if report.reportDetails}
					<div class="food-warning-report-review__report-note">
						<strong>User explanation</strong>
						<p>{report.reportDetails}</p>
					</div>
				{/if}

				<CollapsibleSection title="Evidence details" surface="panel">
					<div class="food-warning-report-review__evidence">
						{#if storedFacts.length > 0}
							<div class="food-warning-report-review__stored-facts">
								<strong>Stored records</strong>
								<ul>
									{#each storedFacts as fact (`${fact.label}:${fact.factType}:${fact.sourceType}:${fact.sourceText ?? ""}`)}
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
						<h3>Choose the supported outcome</h3>
						<p>
							Keep the current behavior when the evidence supports it. Route a
							correction only when the user’s report is right.
						</p>
					</header>
					<SelectField
						id={`compatibility-outcome-${report.id}`}
						name="status"
						label="What does the evidence support?"
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
								label: "The user’s report is correct",
							},
							{
								value: "dismissed",
								label: "The current warning is correct",
							},
						]}
						helper={decision.status === "confirmed"
							? "This confirms the report. Choose who owns the correction below; saving does not change live product data or policy by itself."
							: decision.status === "dismissed"
								? "This closes the report with no follow-up and leaves the current warning behavior unchanged."
								: "Choose between the current warning and the user’s report."}
						onValueChange={(value) =>
							setDecisionStatus(report.id, value as "confirmed" | "dismissed")}
						disabled={pendingReportId !== null}
						required
					/>
					{#if decision.status === "confirmed"}
						<SelectField
							id={`compatibility-action-${report.id}`}
							name="resolutionAction"
							label="Who owns the correction?"
							value={decision.resolutionAction}
							options={getResolutionOptions()}
							helper={getResolutionExplanation(decision.resolutionAction)}
							onValueChange={(value) => setResolutionAction(report.id, value)}
							disabled={pendingReportId !== null}
							required
						/>
					{:else if decision.status === "dismissed"}
						<input type="hidden" name="resolutionAction" value="none" />
					{/if}
					<TextField
						id={`compatibility-review-note-${report.id}`}
						name="reviewNote"
						label="Evidence checked"
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
							(decision.status === "confirmed" && !decision.resolutionAction) ||
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
