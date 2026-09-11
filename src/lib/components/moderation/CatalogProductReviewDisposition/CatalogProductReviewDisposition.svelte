<script lang="ts">
	import { enhance } from "$app/forms";
	import type { SubmitFunction } from "@sveltejs/kit";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import type { CatalogProductReviewDispositionProps } from "./types";

	let {
		passport,
		category,
		canFinishReview,
		form = null,
	}: CatalogProductReviewDispositionProps = $props();
	let reviewNote = $state("");
	let pending = $state(false);

	const isDiagnostic = $derived(category === "diagnostic");
	const completion = $derived(
		isDiagnostic
			? passport.diagnosticReviewCompletion
			: passport.reviewCompletion,
	);
	const disposition = $derived(
		isDiagnostic
			? passport.diagnosticReviewDisposition
			: passport.reviewDisposition,
	);
	const issueCount = $derived(
		passport.issues.filter((issue) =>
			isDiagnostic
				? issue.workCategory === "catalog_diagnostic"
				: issue.workCategory === "publication_blocker",
		).length,
	);
	const remainingCheckCount = $derived(
		Math.max(
			completion.requiredSafeRepairCheckCount -
				completion.completedSafeRepairCheckCount,
			0,
		),
	);
	const enhanceFinish: SubmitFunction = ({ cancel }) => {
		if (pending) {
			cancel();
			return;
		}
		pending = true;
		return async ({ update }) => {
			try {
				await update();
			} finally {
				pending = false;
			}
		};
	};
</script>

{#if disposition}
	<section
		class="catalog-product-review-disposition catalog-product-review-disposition--complete"
	>
		<StatusMessage
			tone="success"
			title={isDiagnostic
				? "Evidence follow-up finished"
				: "Review finished — kept out of the public API"}
			message={isDiagnostic
				? `${disposition.issueCount} current evidence ${disposition.issueCount === 1 ? "follow-up is" : "follow-ups are"} no longer in the work queue. Product data and public API availability are unchanged. New or changed evidence will automatically reopen the review.`
				: `${disposition.issueCount} current ${disposition.issueCount === 1 ? "item is" : "items are"} no longer in the work queue. The product is still available inside blendCalc. New or changed evidence will automatically reopen the review.`}
		/>
		<dl>
			<div>
				<dt>Recorded reason</dt>
				<dd>{disposition.reviewNote}</dd>
			</div>
		</dl>
	</section>
{:else if issueCount > 0 && canFinishReview}
	<section
		class="catalog-product-review-disposition"
		id={isDiagnostic ? "finish-evidence-review" : "finish-publication-review"}
		tabindex="-1"
	>
		<header>
			<span>Final step</span>
			<h2>
				{isDiagnostic
					? "Finish the evidence follow-up"
					: "Finish this product review"}
			</h2>
		</header>
		<p>
			{isDiagnostic
				? "Use this after the history checks cannot reconstruct exact evidence and no additional source is available today."
				: "Use this after the safe checks cannot prove a repair and the remaining missing evidence is not available today."}
		</p>

		<div class="catalog-product-review-disposition__effects">
			<strong>When you finish:</strong>
			<ul>
				<li>The product stays available in blendCalc.</li>
				{#if isDiagnostic}
					<li>Its current public blendCalcAPI v1 status does not change.</li>
					<li>Only these current evidence follow-ups leave the work queue.</li>
					<li>No product values or revision history are rewritten.</li>
				{:else}
					<li>It stays withheld from public blendCalcAPI v1.</li>
					<li>These current publication items leave the work queue.</li>
				{/if}
				<li>New or changed evidence automatically reopens the review.</li>
			</ul>
		</div>

		{#if completion.requiredSafeRepairCheckCount > 0}
			<p class="catalog-product-review-disposition__progress">
				<strong
					>{completion.completedSafeRepairCheckCount} of {completion.requiredSafeRepairCheckCount}</strong
				>
				safe repair checks finished with no safe change.
			</p>
		{/if}

		{#if remainingCheckCount > 0}
			<StatusMessage
				tone="info"
				title={`${remainingCheckCount} ${remainingCheckCount === 1 ? "check remains" : "checks remain"}`}
				message={isDiagnostic
					? "Run each available evidence check above. Apply an exact repair when one is found; an inconclusive check also counts as complete."
					: "Run each available Check repair action above. If a check finds an exact repair, apply it. If it finds no safe change, it counts as complete."}
			/>
		{/if}

		{#if form?.catalogReviewDispositionError && form.catalogReviewDispositionCategory === category}
			<StatusMessage
				tone="danger"
				message={form.catalogReviewDispositionError}
			/>
		{/if}

		<form
			method="POST"
			action="?/finishCatalogReview"
			use:enhance={enhanceFinish}
		>
			<input type="hidden" name="reviewCategory" value={category} />
			<TextField
				id={`catalog-review-${category}-disposition-note`}
				name="reviewNote"
				label={isDiagnostic
					? "Why can this evidence not be reconstructed today?"
					: "Why can this product not be published yet?"}
				value={reviewNote}
				placeholder={isDiagnostic
					? "For example: Revision 4 has no field-by-field summary, matching submission, or exact stored observation."
					: "For example: The current label does not provide the missing potassium value, and no approved source can supply it."}
				helper="Required. This note becomes part of the private review record."
				minlength={10}
				maxlength={2000}
				showCharacterCount
				multiline
				required
				disabled={pending}
				oninput={(event) => (reviewNote = event.currentTarget.value)}
			/>
			<ActionButton
				type="submit"
				variant="primary"
				fullWidth
				busy={pending}
				disabled={!completion.canFinish || reviewNote.trim().length < 10}
			>
				{isDiagnostic
					? "Finish evidence follow-up"
					: "Finish review — keep out of public API"}
			</ActionButton>
		</form>
	</section>
{/if}

<style lang="scss">
	@use "./CatalogProductReviewDisposition.scss";
</style>
