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
	let decisionByReportId = $state<Record<string, "" | "dismissed" | "removed">>(
		{},
	);
	let reviewNoteByReportId = $state<Record<string, string>>({});

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

	const getDecision = (reportId: string) => decisionByReportId[reportId] ?? "";

	const setDecision = (reportId: string, value: string) => {
		if (value !== "dismissed" && value !== "removed") return;
		decisionByReportId = { ...decisionByReportId, [reportId]: value };
	};
	const setReviewNote = (reportId: string, reviewNote: string) => {
		reviewNoteByReportId = { ...reviewNoteByReportId, [reportId]: reviewNote };
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
			{@const decision = getDecision(report.id)}
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
					<header class="profile-image-report-review__decision-heading">
						<span>Record the outcome</span>
						<h3>Finish this review in two steps</h3>
						<ol>
							<li>Choose whether the image itself breaks the rules.</li>
							<li>Record what you saw and which report reasons it supports.</li>
						</ol>
					</header>
					<SelectField
						id={`profile-image-decision-${report.id}`}
						name="decision"
						label="1. Does this image break the profile-image rules?"
						value={decision}
						onValueChange={(value) => setDecision(report.id, value)}
						options={[
							{
								value: "",
								label: "Choose a decision",
								disabled: true,
								hidden: true,
								placeholder: true,
							},
							{
								value: "dismissed",
								label: "No — keep the current image",
							},
							{
								value: "removed",
								label: "Yes — remove this exact image",
							},
						]}
						helper={decision === "removed"
							? "Removing clears this exact current image. It does not affect a replacement image."
							: decision === "dismissed"
								? "Keeping dismisses every pending report attached to this exact image."
								: "Keep leaves the image visible and dismisses its reports. Remove clears this exact image and resolves its reports."}
						disabled={pendingReportId !== null}
						required
					/>
					<TextField
						id={`profile-image-review-note-${report.id}`}
						name="reviewNote"
						label="2. What evidence supports this decision?"
						placeholder="Example: Image contains no prohibited content; impersonation report is unsupported."
						helper="Describe what is visible and which report reasons the evidence supports or disproves. Saved privately."
						maxlength={2000}
						multiline
						rows={3}
						disabled={pendingReportId !== null}
						oninput={(event) =>
							setReviewNote(report.id, event.currentTarget.value)}
						required
					/>
					<ActionButton
						type="submit"
						variant={decision === "removed" ? "danger" : "primary"}
						fullWidth
						busy={pendingReportId === report.id}
						disabled={pendingReportId !== null ||
							!decision ||
							!reviewNoteByReportId[report.id]?.trim()}
						>{decision === "removed"
							? "Remove image and resolve reports"
							: decision === "dismissed"
								? "Keep image and dismiss reports"
								: "Save decision"}</ActionButton
					>
				</form>
			</ModeratorReviewCard>
		{/each}
	</ModeratorReviewList>
</section>

<style lang="scss">
	@use "./ProfileImageReportReviewList.scss";
</style>
