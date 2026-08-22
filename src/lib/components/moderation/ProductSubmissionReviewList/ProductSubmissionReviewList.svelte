<script lang="ts">
	import { enhance } from "$app/forms";
	import type { SubmitFunction } from "@sveltejs/kit";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import ImagePlacementEditor from "$lib/components/common/images/ImagePlacementEditor/ImagePlacementEditor.svelte";
	import ModeratorReviewCard from "$lib/components/moderation/ModeratorReviewCard/ModeratorReviewCard.svelte";
	import ModeratorReviewList from "$lib/components/moderation/ModeratorReviewList/ModeratorReviewList.svelte";
	import type { ImagePlacementValue } from "$lib/utils/food/images/types";
	import type { ProductSubmissionReviewListProps } from "./types";

	let {
		submissions,
		form = null,
		showHeading = false,
	}: ProductSubmissionReviewListProps = $props();
	let pendingSubmissionId = $state<string | null>(null);
	let imagePlacementBySubmissionId = $state<Record<string, ImagePlacementValue>>({});

	const getImagePlacement = (
		submission: ProductSubmissionReviewListProps["submissions"][number],
	) => imagePlacementBySubmissionId[submission.id] ?? submission.imageCrop;

	const setImagePlacement = (
		submission: ProductSubmissionReviewListProps["submissions"][number],
		value: ImagePlacementValue,
	) => {
		imagePlacementBySubmissionId = {
			...imagePlacementBySubmissionId,
			[submission.id]: value,
		};
	};

	const enhanceProductDecision: SubmitFunction = ({ formData, cancel }) => {
		if (pendingSubmissionId) {
			cancel();
			return;
		}

		pendingSubmissionId = String(formData.get("submissionId") ?? "");
		return async ({ update }) => {
			try {
				await update({ reset: false });
			} finally {
				pendingSubmissionId = null;
			}
		};
	};
</script>

<section
	class="product-submission-review"
	aria-labelledby={showHeading ? "product-submission-review-title" : undefined}
	aria-label={showHeading ? undefined : "Product submissions"}
>
	{#if showHeading}
		<header class="product-submission-review__heading">
			<h2 id="product-submission-review-title">Product submissions</h2>
			<p>Compare submitted package evidence with the values proposed for the shared catalog.</p>
		</header>
	{/if}

	{#if form?.productReviewError}
		<StatusMessage tone="danger" message={form.productReviewError} />
	{:else if form?.productReviewSuccess}
		<StatusMessage tone="success" message={form.productReviewSuccess} />
	{/if}

	<ModeratorReviewList
		label="Product submission review queue"
		itemCount={submissions.length}
		singularItemLabel="submission waiting for review"
		pluralItemLabel="submissions waiting for review"
		emptyTitle="No product submissions need review"
		emptyDescription="New evidence-backed submissions will appear here."
	>
		{#each submissions as submission (submission.id)}
			<ModeratorReviewCard
				title={submission.productName}
				subtitle={submission.brandOwner ?? "Brand not provided"}
			>
				{#snippet status()}
					{#if submission.isQaFixture}<TextBadge label="QA fixture" tone="warning" />{/if}
					{#if submission.updateReview}
						<TextBadge
							label={submission.submissionIntent === "catalog_correction" ? "Correction" : "Update"}
							tone="info"
						/>
					{/if}
					<TextBadge label="Needs review" tone="warning" />
				{/snippet}

				<dl class="product-submission-review__facts">
					<div><dt>Barcode</dt><dd>{submission.barcode}</dd></div>
					<div><dt>Matched food</dt><dd>{submission.matchedSource ?? "No exact match"}</dd></div>
					<div><dt>Package photos</dt><dd>{submission.evidenceComplete ? "Complete" : "Incomplete"}</dd></div>
					<div><dt>Differences</dt><dd>{submission.conflictCount}</dd></div>
				</dl>

				{#if submission.externalLookupFailed}
					<StatusMessage
						tone="warning"
						message="An outside comparison was unavailable. Check the package label carefully before deciding."
					/>
				{/if}
				{#if submission.validationIssues.length > 0}
					<div class="product-submission-review__flags">
						<strong>Review before deciding</strong>
						<ul>
							{#each submission.validationIssues as issue}<li>{issue}</li>{/each}
						</ul>
					</div>
				{/if}
				{#if submission.isQaFixture}
					<StatusMessage
						tone="warning"
						message="This test submission can be rejected for QA, but it cannot be published."
					/>
				{/if}

				{#if submission.updateReview}
					<CollapsibleSection
						title="Proposed catalog changes"
						badge={`${submission.updateReview.changes.length}`}
						surface="panel"
					>
						<div class="product-submission-review__stack">
							<p>
								Compared with revision {submission.updateReview.baseRevisionNumber}. The package label was checked on {submission.labelObservedDate}.
							</p>
							<ul class="product-submission-review__changes">
								{#each submission.updateReview.changes as change (change.field)}
									<li>
										<strong>{change.label}</strong>
										<span>{change.previousValue} → {change.submittedValue}</span>
									</li>
								{/each}
							</ul>
							<div>
								<strong>Outside checks</strong>
								<ul class="product-submission-review__changes">
									{#each submission.updateReview.sourceChecks as sourceCheck (sourceCheck.source)}
										<li><span>{sourceCheck.source}</span><strong>{sourceCheck.status}</strong></li>
									{/each}
								</ul>
							</div>
						</div>
					</CollapsibleSection>
				{/if}

				<CollapsibleSection
					title="Package evidence"
					badge={`${submission.evidence.length}`}
					surface="panel"
					tone={submission.evidence.length > 0 ? "neutral" : "danger"}
				>
					{#if submission.evidence.length > 0}
						<div class="product-submission-review__evidence" aria-label="Private product evidence">
							{#each submission.evidence as evidence (evidence.key)}
								<a href={evidence.url} target="_blank" rel="noreferrer">
									<img src={evidence.url} alt={evidence.label} />
									<span>{evidence.label}</span>
								</a>
							{/each}
						</div>
					{:else}
						<StatusMessage tone="danger" message="This submission has no package evidence and cannot be approved." />
					{/if}
				</CollapsibleSection>

				{#if submission.frontEvidenceUrl}
					<CollapsibleSection title="Card image placement" surface="panel">
						<ImagePlacementEditor
							imageUrl={submission.frontEvidenceUrl}
							alt="Product image preview"
							foodName={submission.productName}
							brandName={submission.brandOwner ?? ""}
							category="Catalog product"
							title="Card image preview"
							description="Drag the image in the card preview or use the controls before approving."
							value={getImagePlacement(submission)}
							onChange={(value) => setImagePlacement(submission, value)}
						/>
					</CollapsibleSection>
				{/if}

				<CollapsibleSection
					title="Nutrition values"
					badge={`${submission.nutrients.length}`}
					surface="panel"
				>
					<ul class="product-submission-review__nutrition">
						{#each submission.nutrients as nutrient}
							<li><span>{nutrient.name}</span><strong>{nutrient.value} {nutrient.unit}</strong></li>
						{/each}
					</ul>
				</CollapsibleSection>

				<div class="product-submission-review__decision" aria-label={`Decision for ${submission.productName}`}>
					<form method="POST" action="?/approveProduct" use:enhance={enhanceProductDecision}>
						<input type="hidden" name="submissionId" value={submission.id} />
						<input type="hidden" name="imageCropX" value={getImagePlacement(submission).cropX} />
						<input type="hidden" name="imageCropY" value={getImagePlacement(submission).cropY} />
						<input type="hidden" name="imageCropZoom" value={getImagePlacement(submission).cropZoom} />
						<input type="hidden" name="imageRotationDegrees" value={getImagePlacement(submission).rotationDegrees} />
						<input type="hidden" name="imageFitMode" value={getImagePlacement(submission).fitMode} />
						<input type="hidden" name="imagePlacementVersion" value={getImagePlacement(submission).placementVersion} />
						<input type="hidden" name="imagePlacementMethod" value={getImagePlacement(submission).placementMethod ?? "manual"} />
						<input type="hidden" name="imageSuggestionVersion" value={getImagePlacement(submission).suggestionVersion ?? ""} />
						<input type="hidden" name="imageSuggestionConfidence" value={getImagePlacement(submission).suggestionConfidence ?? ""} />
						<ActionButton
							type="submit"
							variant="success"
							fullWidth
							busy={pendingSubmissionId === submission.id}
							disabled={pendingSubmissionId !== null || !submission.evidenceComplete || submission.isQaFixture}
						>Approve submission</ActionButton>
					</form>
					<form class="product-submission-review__reject" method="POST" action="?/rejectProduct" use:enhance={enhanceProductDecision}>
						<input type="hidden" name="submissionId" value={submission.id} />
						<TextField
							id={`product-rejection-note-${submission.id}`}
							name="reviewNote"
							label="Correction needed"
							placeholder="What needs to be corrected?"
							maxlength={1000}
							disabled={pendingSubmissionId !== null}
							required
						/>
						<ActionButton
							type="submit"
							variant="danger"
							fullWidth
							busy={pendingSubmissionId === submission.id}
							disabled={pendingSubmissionId !== null}
						>Reject submission</ActionButton>
					</form>
				</div>
			</ModeratorReviewCard>
		{/each}
	</ModeratorReviewList>
</section>

<style lang="scss">
	@use "./ProductSubmissionReviewList.scss";
</style>
