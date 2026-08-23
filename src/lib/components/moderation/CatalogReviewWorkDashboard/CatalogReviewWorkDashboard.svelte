<script lang="ts">
	import { enhance } from "$app/forms";
	import type { SubmitFunction } from "@sveltejs/kit";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import {
		getCatalogFieldLabel,
		getCatalogHealthStatusLabel,
	} from "$lib/utils/moderation/catalogHealthMessages";
	import type { CatalogReviewWorkDashboardProps } from "./types";

	let { reviewWork }: CatalogReviewWorkDashboardProps = $props();
	let pendingReviewId = $state<string | null>(null);

	const dateFormatter = new Intl.DateTimeFormat("en", {
		dateStyle: "medium",
	});
	const formatDate = (value: string) => {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? "Date unavailable" : dateFormatter.format(date);
	};
	const enhanceReview: SubmitFunction = ({ formData, cancel }) => {
		if (pendingReviewId) {
			cancel();
			return;
		}
		pendingReviewId = String(formData.get("matchId") ?? formData.get("reviewId") ?? "");
		return async ({ update }) => {
			try {
				await update({ reset: false });
			} finally {
				pendingReviewId = null;
			}
		};
	};
</script>

<div class="catalog-review-work">
	<p class="catalog-review-work__intro">
		Resolve product conflicts, provider changes, and possible recall matches. The current
		approved product stays available until a supported correction is accepted.
	</p>

	<CollapsibleSection
		title="Possible recall matches"
		badge={`${reviewWork.counts.safetyMatches}`}
		surface="panel"
	>
		<div class="catalog-review-work__stack">
			{#each reviewWork.safetyMatches as match (match.id)}
				<article class="catalog-review-work__record">
					<header>
						<div>
							<strong>{match.productName}</strong>
							<span>{match.brandOwner ?? "Brand unavailable"} · {match.barcode}</span>
						</div>
						<TextBadge label={match.classification ?? "Official notice"} tone="info" />
					</header>
					<p><strong>Official notice:</strong> {match.alertProductDescription}</p>
					{#if match.reason}<p>{match.reason}</p>{/if}
					{#if match.packageDescription}<p><strong>Package:</strong> {match.packageDescription}</p>{/if}
					{#if match.codeInformation}<p><strong>Codes:</strong> {match.codeInformation}</p>{/if}
					<a href={match.sourceUrl} target="_blank" rel="noreferrer">
						Read the official {match.sourceName} notice
					</a>
					<form method="POST" action="?/reviewSafetyMatch" use:enhance={enhanceReview}>
						<input type="hidden" name="matchId" value={match.id} />
						<SelectField
							id={`safety-match-outcome-${match.id}`}
							name="outcome"
							label="Decision"
							value="confirmed"
							options={[
								{ value: "confirmed", label: "This is the affected product" },
								{ value: "dismissed", label: "This is a different product" },
							]}
							required
						/>
						<TextField
							id={`safety-match-review-note-${match.id}`}
							name="reviewNote"
							label="Evidence note"
							placeholder="What confirms or disproves this match?"
							maxlength={2000}
							multiline
							rows={3}
							required
						/>
						<ActionButton
							type="submit"
							variant="success"
							size="small"
							busy={pendingReviewId === match.id}
							disabled={pendingReviewId !== null}
						>Save decision</ActionButton>
					</form>
				</article>
			{:else}
				<p class="catalog-review-work__empty">No possible recall matches need review.</p>
			{/each}
		</div>
	</CollapsibleSection>

	<CollapsibleSection
		title="Provider changes"
		badge={`${reviewWork.counts.providerChanges}`}
		surface="panel"
	>
		<div class="catalog-review-work__stack">
			{#each reviewWork.providerChanges as change (change.id)}
				<article class="catalog-review-work__record">
					<header>
						<div>
							<strong>{change.productName}</strong>
							<span>{change.barcode} · observed {formatDate(change.observedAt)}</span>
						</div>
						<TextBadge label={change.sourceName} tone="info" />
					</header>
					<ul>
						{#each change.changeSummary.changes as detail (detail.field)}
							<li>{getCatalogFieldLabel(detail.field)} · {getCatalogHealthStatusLabel(detail.severity)}</li>
						{/each}
					</ul>
					<a href={`/profile/privileged-tools/catalog-review-work/products/${encodeURIComponent(change.sharedProductId)}`}>
						Review product evidence
					</a>
					<p class="catalog-review-work__guidance">
						Keep the current record only when its existing evidence is still stronger. Supported
						changes belong in a correction so approval creates a new revision.
					</p>
					<form method="POST" action="?/dismissProviderChange" use:enhance={enhanceReview}>
						<input type="hidden" name="reviewId" value={change.id} />
						<TextField
							id={`provider-change-review-note-${change.id}`}
							name="reviewNote"
							label="Why should the current record stay?"
							placeholder="Describe the evidence supporting the current product."
							maxlength={2000}
							multiline
							rows={3}
							required
						/>
						<ActionButton
							type="submit"
							variant="success"
							size="small"
							busy={pendingReviewId === change.id}
							disabled={pendingReviewId !== null}
						>Keep current record</ActionButton>
					</form>
				</article>
			{:else}
				<p class="catalog-review-work__empty">No provider changes need review.</p>
			{/each}
		</div>
	</CollapsibleSection>

	<CollapsibleSection
		title="Product conflicts"
		badge={`${reviewWork.counts.conflicts}`}
		surface="panel"
	>
		<div class="catalog-review-work__stack">
			{#each reviewWork.conflicts as conflict (conflict.id)}
				<a
					class="catalog-review-work__record catalog-review-work__record--link"
					href={`/profile/privileged-tools/catalog-review-work/products/${encodeURIComponent(conflict.productId)}`}
				>
					<span>
						<strong>{conflict.productName}</strong>
						<small>{conflict.barcode} · {getCatalogFieldLabel(conflict.fieldPath)}</small>
					</span>
					<TextBadge label={getCatalogHealthStatusLabel(conflict.severity)} tone="warning" />
				</a>
			{:else}
				<p class="catalog-review-work__empty">No product conflicts need review.</p>
			{/each}
		</div>
	</CollapsibleSection>
</div>

<style lang="scss">
	@use "./CatalogReviewWorkDashboard.scss";
</style>
