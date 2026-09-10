<script lang="ts">
	import { enhance } from "$app/forms";
	import type { SubmitFunction } from "@sveltejs/kit";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import type { CatalogProductReviewDispositionProps } from "./types";

	let {
		passport,
		canFinishReview,
		form = null,
	}: CatalogProductReviewDispositionProps = $props();
	let reviewNote = $state("");
	let pending = $state(false);

	const completion = $derived(passport.reviewCompletion);
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

{#if passport.reviewDisposition}
	<section
		class="catalog-product-review-disposition catalog-product-review-disposition--complete"
	>
		<StatusMessage
			tone="success"
			title="Review finished — kept out of the public API"
			message={`${passport.reviewDisposition.issueCount} current ${passport.reviewDisposition.issueCount === 1 ? "item is" : "items are"} no longer in the work queue. The product is still available inside blendCalc. New or changed evidence will automatically reopen the review.`}
		/>
		<dl>
			<div>
				<dt>Recorded reason</dt>
				<dd>{passport.reviewDisposition.reviewNote}</dd>
			</div>
		</dl>
	</section>
{:else if passport.issues.length > 0 && canFinishReview}
	<section
		class="catalog-product-review-disposition"
		id="finish-product-review"
	>
		<header>
			<span>Final step</span>
			<h2>Finish this product review</h2>
		</header>
		<p>
			Use this after the safe checks cannot prove a repair and the remaining
			missing evidence is not available today.
		</p>

		<div class="catalog-product-review-disposition__effects">
			<strong>When you finish:</strong>
			<ul>
				<li>The product stays available in blendCalc.</li>
				<li>It stays withheld from public blendCalcAPI v1.</li>
				<li>These current readiness items leave the work queue.</li>
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
				message="Run each available Check repair action above. If a check finds an exact repair, apply it. If it finds no safe change, it counts as complete."
			/>
		{/if}

		{#if form?.catalogReviewDispositionError}
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
			<TextField
				id="catalog-review-disposition-note"
				name="reviewNote"
				label="Why can this product not be published yet?"
				value={reviewNote}
				placeholder="For example: The current label does not provide the missing potassium value, and no approved source can supply it."
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
				Finish review — keep out of public API
			</ActionButton>
		</form>
	</section>
{/if}

<style lang="scss">
	@use "./CatalogProductReviewDisposition.scss";
</style>
