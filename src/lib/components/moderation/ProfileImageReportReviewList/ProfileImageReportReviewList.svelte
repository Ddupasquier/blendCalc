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
	import type { ProfileImageReportReasonCode } from "$lib/server/moderation/profileImageReports.server";
	import type { ProfileImageReportReviewListProps } from "./types";

	let {
		reports,
		form = null,
		showHeading = false,
	}: ProfileImageReportReviewListProps = $props();
	let pendingReportId = $state<string | null>(null);
	let decisionByReportId = $state<Record<string, "dismissed" | "removed">>({});

	const reasonLabels: Record<ProfileImageReportReasonCode, string> = {
		explicit_content: "Explicit content",
		graphic_violence: "Graphic violence",
		hate_or_harassment: "Hate or harassment",
		impersonation: "Impersonation",
		other: "Another concern",
	};

	const formatReportDate = (value: string) =>
		new Intl.DateTimeFormat("en", {
			month: "short",
			day: "numeric",
			year: "numeric",
			timeZone: "UTC",
		}).format(new Date(value));

	const getDecision = (reportId: string) =>
		decisionByReportId[reportId] ?? "dismissed";

	const setDecision = (reportId: string, value: string) => {
		if (value !== "dismissed" && value !== "removed") return;
		decisionByReportId = { ...decisionByReportId, [reportId]: value };
	};

	const enhanceReview: SubmitFunction = ({ formData, cancel }) => {
		if (pendingReportId) {
			cancel();
			return;
		}

		pendingReportId = String(formData.get("reportId") ?? "");
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
	class="profile-image-report-review"
	aria-labelledby={showHeading
		? "profile-image-report-review-title"
		: undefined}
	aria-label={showHeading ? undefined : "Reported profile images"}
>
	{#if showHeading}
		<header class="profile-image-report-review__heading">
			<h2 id="profile-image-report-review-title">Profile images</h2>
			<p>Review only exact images another user reported.</p>
		</header>
	{/if}

	{#if form?.profileImageReviewError}
		<StatusMessage tone="danger" message={form.profileImageReviewError} />
	{:else if form?.profileImageReviewSuccess}
		<StatusMessage tone="success" message={form.profileImageReviewSuccess} />
	{/if}

	<ModeratorReviewList
		label="Reported profile image review queue"
		itemCount={reports.length}
		singularItemLabel="image waiting for review"
		pluralItemLabel="images waiting for review"
		emptyTitle="No reported profile images need review"
		emptyDescription="Ordinary profile-image uploads are published without entering this queue."
	>
		{#each reports as report (report.id)}
			<ModeratorReviewCard
				title={report.displayName}
				subtitle={`First reported ${formatReportDate(report.createdAt)}`}
			>
				{#snippet status()}
					<TextBadge
						label={`${report.reports.length} ${report.reports.length === 1 ? "report" : "reports"}`}
						tone="warning"
					/>
				{/snippet}

				<div class="profile-image-report-review__preview">
					{#if report.avatarUrl}
						<img
							src={report.avatarUrl}
							alt={report.avatarAltText || "Profile image reported for review"}
						/>
					{:else}
						<span>Preview unavailable</span>
					{/if}
				</div>

				<CollapsibleSection
					title="Report details"
					badge={`${report.reports.length}`}
					surface="panel"
				>
					<ul
						class="profile-image-report-review__reasons"
						aria-label="Report reasons"
					>
						{#each report.reports as item (item.id)}
							<li>
								<strong>{reasonLabels[item.reasonCode]}</strong>
								{#if item.details}<p>{item.details}</p>{/if}
								<span>{formatReportDate(item.createdAt)}</span>
							</li>
						{/each}
					</ul>
				</CollapsibleSection>

				<StatusMessage
					tone="info"
					message="The image stays visible during review. Remove it only when the image itself breaks the profile-image rules."
				/>

				<form
					class="profile-image-report-review__decision"
					method="POST"
					action="?/reviewProfileImageReport"
					use:enhance={enhanceReview}
					aria-busy={pendingReportId === report.id}
				>
					<input type="hidden" name="reportId" value={report.id} />
					<SelectField
						id={`profile-image-decision-${report.id}`}
						name="decision"
						label="Decision"
						value={getDecision(report.id)}
						onValueChange={(value) => setDecision(report.id, value)}
						options={[
							{ value: "dismissed", label: "Keep image" },
							{ value: "removed", label: "Remove image" },
						]}
						disabled={pendingReportId !== null}
						required
					/>
					<TextField
						id={`profile-image-review-note-${report.id}`}
						name="reviewNote"
						label="Review note"
						placeholder="What did you verify?"
						helper="Required for the private moderation record."
						maxlength={2000}
						multiline
						rows={3}
						disabled={pendingReportId !== null}
						required
					/>
					<ActionButton
						type="submit"
						variant={getDecision(report.id) === "removed"
							? "danger"
							: "primary"}
						fullWidth
						busy={pendingReportId === report.id}
						disabled={pendingReportId !== null}>Save decision</ActionButton
					>
				</form>
			</ModeratorReviewCard>
		{/each}
	</ModeratorReviewList>
</section>

<style lang="scss">
	@use "./ProfileImageReportReviewList.scss";
</style>
