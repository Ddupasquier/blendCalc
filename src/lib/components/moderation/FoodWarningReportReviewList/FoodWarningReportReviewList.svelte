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
	import type { FoodWarningReportReviewListProps } from "./types";

	let {
		reports,
		form = null,
		showHeading = false,
	}: FoodWarningReportReviewListProps = $props();
	let pendingReportId = $state<string | null>(null);

	const formatReadableLabel = (value: string) =>
		value
			.replaceAll("_", " ")
			.replace(/^./u, (letter) => letter.toLocaleUpperCase());

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
			<ModeratorReviewCard
				title={report.foodDescription}
				subtitle={`${report.feedbackType === "missing_warning" ? "Missing warning" : "Incorrect warning"} · Policy ${report.policyVersion ? `v${report.policyVersion}` : "version unavailable"}`}
			>
				{#snippet status()}<TextBadge
						label="Needs review"
						tone="warning"
					/>{/snippet}

				<dl class="food-warning-report-review__facts">
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
					<div>
						<dt>Report reason</dt>
						<dd>{formatReadableLabel(report.reportReason)}</dd>
					</div>
				</dl>

				{#if report.reportDetails}
					<div class="food-warning-report-review__report-note">
						<strong>User explanation</strong>
						<p>{report.reportDetails}</p>
					</div>
				{/if}

				<CollapsibleSection title="Report evidence" surface="panel">
					<div class="food-warning-report-review__evidence">
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
						{#if report.evidenceUrl}
							<a
								href={report.evidenceUrl}
								target="_blank"
								rel="noopener noreferrer"
							>
								Open private package-label evidence
							</a>
						{/if}
						<CollapsibleSection title="Stored matching facts" surface="panel">
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
					<SelectField
						id={`compatibility-outcome-${report.id}`}
						name="status"
						label="Decision"
						value="confirmed"
						options={[
							{
								value: "confirmed",
								label:
									report.feedbackType === "missing_warning"
										? "Warning is missing"
										: "Warning appears incorrect",
							},
							{
								value: "dismissed",
								label:
									report.feedbackType === "missing_warning"
										? "Current warning coverage is supported"
										: "Current warning is supported",
							},
						]}
						disabled={pendingReportId !== null}
						required
					/>
					<SelectField
						id={`compatibility-action-${report.id}`}
						name="resolutionAction"
						label="Next step"
						value="rule_review"
						options={[
							{ value: "rule_review", label: "Review the warning rule" },
							{
								value: "source_correction",
								label: "Correct the source mapping",
							},
							{
								value: "product_correction",
								label: "Correct the product data",
							},
							{ value: "duplicate", label: "Close as a duplicate" },
							{ value: "none", label: "No follow-up needed" },
						]}
						disabled={pendingReportId !== null}
						required
					/>
					<TextField
						id={`compatibility-review-note-${report.id}`}
						name="reviewNote"
						label="Review note"
						placeholder="What evidence supports this decision?"
						helper="Saved in the private moderation record."
						maxlength={2000}
						multiline
						rows={3}
						disabled={pendingReportId !== null}
						required
					/>
					<ActionButton
						type="submit"
						fullWidth
						busy={pendingReportId === report.id}
						disabled={pendingReportId !== null}>Save review</ActionButton
					>
				</form>
			</ModeratorReviewCard>
		{/each}
	</ModeratorReviewList>
</section>

<style lang="scss">
	@use "./FoodWarningReportReviewList.scss";
</style>
