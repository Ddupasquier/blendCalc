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
	import { formatCatalogEvidenceValue } from "$lib/utils/moderation/catalogReviewWork";
	import type { CatalogReviewWorkDashboardProps } from "./types";

	let {
		reviewWork,
		hideConflicts = false,
		hideHeading = false,
	}: CatalogReviewWorkDashboardProps = $props();
	let pendingReviewId = $state<string | null>(null);
	let safetyDecisionByMatchId = $state<
		Record<string, "" | "confirmed" | "dismissed">
	>({});
	let safetyNoteByMatchId = $state<Record<string, string>>({});
	let providerNoteByReviewId = $state<Record<string, string>>({});

	const dateFormatter = new Intl.DateTimeFormat("en", {
		dateStyle: "medium",
	});
	const formatDate = (value: string) => {
		const date = new Date(value);
		return Number.isNaN(date.getTime())
			? "Date unavailable"
			: dateFormatter.format(date);
	};
	const setSafetyDecision = (matchId: string, outcome: string) => {
		if (outcome !== "confirmed" && outcome !== "dismissed") return;
		safetyDecisionByMatchId = {
			...safetyDecisionByMatchId,
			[matchId]: outcome,
		};
	};
	const formatAgreement = (value: unknown) =>
		typeof value === "number"
			? `${Math.round((value <= 1 ? value * 100 : value) * 10) / 10}%`
			: "Not recorded";
	const recallEvidenceRows = (
		evidence: Record<string, unknown>,
		requiresPackageCheck: boolean,
	) => [
		{
			label: "Match basis",
			value:
				evidence.matchBasis === "exact_gtin"
					? "The notice contains this exact product code."
					: evidence.matchBasis === "brand_product_package"
						? "The brand, product name, and package description appear similar."
						: formatCatalogEvidenceValue(evidence.matchBasis),
		},
		...(typeof evidence.matchedIdentifier === "string"
			? [{ label: "Matched product code", value: evidence.matchedIdentifier }]
			: []),
		...(typeof evidence.brandAgreement === "number"
			? [
					{
						label: "Brand-name agreement",
						value: formatAgreement(evidence.brandAgreement),
					},
				]
			: []),
		...(typeof evidence.productAgreement === "number"
			? [
					{
						label: "Product-name agreement",
						value: formatAgreement(evidence.productAgreement),
					},
				]
			: []),
		...(typeof evidence.packageAgreement === "number"
			? [
					{
						label: "Package agreement",
						value: formatAgreement(evidence.packageAgreement),
					},
				]
			: []),
		{
			label: "Package-code check",
			value: requiresPackageCheck
				? "Required — verify the package, lot, and date codes before confirming."
				: "Not required because the product code matched exactly.",
		},
	];
	const enhanceReview: SubmitFunction = ({ formData, cancel }) => {
		if (pendingReviewId) {
			cancel();
			return;
		}
		pendingReviewId = String(
			formData.get("matchId") ?? formData.get("reviewId") ?? "",
		);
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
	{#if !hideHeading}
		<header class="catalog-review-work__heading">
			<h2>Queues in priority order</h2>
			<p>
				Open the first non-clear queue and work from the oldest evidence
				forward.
			</p>
		</header>
	{/if}

	<CollapsibleSection
		title="Possible recall matches"
		badge={reviewWork.counts.safetyMatches === 0
			? "Clear"
			: `${reviewWork.counts.safetyMatches} to review`}
		surface="panel"
		tone={reviewWork.counts.safetyMatches > 0 ? "danger" : "neutral"}
		open={reviewWork.counts.safetyMatches > 0}
	>
		<div class="catalog-review-work__stack">
			<p class="catalog-review-work__queue-guidance">
				Compare the exact product and package codes with the official notice.
				Confirm a match only when the evidence identifies the same affected
				product.
			</p>
			{#each reviewWork.safetyMatches as match (match.id)}
				{@const safetyDecision = safetyDecisionByMatchId[match.id] ?? ""}
				{@const matchEvidenceRows = recallEvidenceRows(
					match.matchEvidence,
					match.requiresPackageCheck,
				)}
				<article class="catalog-review-work__record">
					<header>
						<div>
							<strong>{match.productName}</strong>
							<span
								>{match.brandOwner ?? "Brand unavailable"} · {match.barcode}</span
							>
						</div>
						<TextBadge
							label={match.classification ?? "Official notice"}
							tone="info"
						/>
					</header>
					<p>
						<strong>Official notice:</strong>
						{match.alertProductDescription}
					</p>
					{#if match.reason}<p>{match.reason}</p>{/if}
					{#if match.packageDescription}<p>
							<strong>Package:</strong>
							{match.packageDescription}
						</p>{/if}
					{#if match.codeInformation}<p>
							<strong>Codes:</strong>
							{match.codeInformation}
						</p>{/if}
					<section
						class="catalog-review-work__evidence"
						aria-label="Why this product was flagged"
					>
						<strong>Why this was flagged</strong>
						<dl>
							{#each matchEvidenceRows as evidence}
								<div>
									<dt>{evidence.label}</dt>
									<dd>{evidence.value}</dd>
								</div>
							{/each}
						</dl>
					</section>
					<a href={match.sourceUrl} target="_blank" rel="noreferrer">
						Read the official {match.sourceName} notice
					</a>
					<form
						method="POST"
						action="?/reviewSafetyMatch"
						use:enhance={enhanceReview}
					>
						<input type="hidden" name="matchId" value={match.id} />
						<header class="catalog-review-work__decision-heading">
							<strong>Finish this safety review in two steps</strong>
							<span>
								Confirm only when the product identity and affected package
								codes match the official notice.
							</span>
						</header>
						<SelectField
							id={`safety-match-outcome-${match.id}`}
							name="outcome"
							label="1. Is this exact product covered by the notice?"
							value={safetyDecision}
							onValueChange={(value) => setSafetyDecision(match.id, value)}
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
									label: "Yes — this is the affected product",
								},
								{
									value: "dismissed",
									label: "No — this is a different product",
								},
							]}
							helper={safetyDecision === "confirmed"
								? "Yes marks this product as covered by the official notice and creates in-app safety alerts for users who saved it."
								: safetyDecision === "dismissed"
									? "No closes this match without showing the official notice for this product."
									: "Yes activates the matched notice and user alerts. No closes the match without attaching the notice to this product."}
							required
						/>
						<TextField
							id={`safety-match-review-note-${match.id}`}
							name="reviewNote"
							label="2. What evidence proves this decision?"
							placeholder="Example: Notice names the same 12 oz package and UPC; lot code matches."
							helper="Record the matching or conflicting identity and package-code evidence."
							maxlength={2000}
							multiline
							rows={3}
							oninput={(event) =>
								(safetyNoteByMatchId = {
									...safetyNoteByMatchId,
									[match.id]: event.currentTarget.value,
								})}
							required
						/>
						<ActionButton
							type="submit"
							variant={safetyDecision === "confirmed" ? "danger" : "primary"}
							size="small"
							busy={pendingReviewId === match.id}
							disabled={pendingReviewId !== null ||
								!safetyDecision ||
								!safetyNoteByMatchId[match.id]?.trim()}
							>{safetyDecision === "confirmed"
								? "Confirm recall match and alert users"
								: safetyDecision === "dismissed"
									? "Dismiss recall match"
									: "Save safety decision"}</ActionButton
						>
					</form>
				</article>
			{:else}
				<p class="catalog-review-work__empty">
					No possible recall matches need review.
				</p>
			{/each}
		</div>
	</CollapsibleSection>

	{#if !hideConflicts}<CollapsibleSection
			title="Product conflicts"
			badge={reviewWork.counts.conflicts === 0
				? "Clear"
				: `${reviewWork.counts.conflicts} to review`}
			surface="panel"
			tone={reviewWork.counts.conflicts > 0 ? "warning" : "neutral"}
			open={reviewWork.counts.safetyMatches === 0 &&
				reviewWork.counts.conflicts > 0}
		>
			<div class="catalog-review-work__stack">
				<p class="catalog-review-work__queue-guidance">
					Open each product to compare the competing values and their
					provenance. Resolve the conflict from the strongest evidence, never
					from preference alone.
				</p>
				{#each reviewWork.conflicts as conflict (conflict.id)}
					<a
						class="catalog-review-work__record catalog-review-work__record--link"
						href={`/profile/privileged-tools/catalog-review-work/products/${encodeURIComponent(conflict.productId)}`}
					>
						<span>
							<strong>{conflict.productName}</strong>
							<small
								>{conflict.barcode} · {getCatalogFieldLabel(
									conflict.fieldPath,
								)}</small
							>
							<small>
								Competing evidence: {conflict.observedValues
									.slice(0, 2)
									.map((entry) =>
										formatCatalogEvidenceValue(
											entry &&
												typeof entry === "object" &&
												!Array.isArray(entry)
												? (entry as Record<string, unknown>).value
												: entry,
										),
									)
									.join(" versus ")}
							</small>
						</span>
						<TextBadge
							label={getCatalogHealthStatusLabel(conflict.severity)}
							tone="warning"
						/>
					</a>
				{:else}
					<p class="catalog-review-work__empty">
						No product conflicts need review.
					</p>
				{/each}
			</div>
		</CollapsibleSection>{/if}

	<CollapsibleSection
		title="Provider changes"
		badge={reviewWork.counts.providerChanges === 0
			? "Clear"
			: `${reviewWork.counts.providerChanges} to review`}
		surface="panel"
		tone={reviewWork.counts.providerChanges > 0 ? "warning" : "neutral"}
		open={reviewWork.counts.safetyMatches === 0 &&
			reviewWork.counts.conflicts === 0 &&
			reviewWork.counts.providerChanges > 0}
	>
		<div class="catalog-review-work__stack">
			<p class="catalog-review-work__queue-guidance">
				Compare the provider observation with the current approved evidence.
				Keep the current record only when its evidence remains stronger;
				otherwise start a correction.
			</p>
			{#each reviewWork.providerChanges as change (change.id)}
				<article class="catalog-review-work__record">
					<header>
						<div>
							<strong>{change.productName}</strong>
							<span
								>{change.barcode} · observed {formatDate(
									change.observedAt,
								)}</span
							>
						</div>
						<TextBadge label={change.sourceName} tone="info" />
					</header>
					<div class="catalog-review-work__changes">
						{#each change.changeSummary.changes as detail (detail.field)}
							<section>
								<header>
									<strong>{getCatalogFieldLabel(detail.field)}</strong>
									<TextBadge
										label={getCatalogHealthStatusLabel(detail.severity)}
										tone="warning"
									/>
								</header>
								<dl>
									<div>
										<dt>Earlier provider value</dt>
										<dd>{formatCatalogEvidenceValue(detail.previousValue)}</dd>
									</div>
									<div>
										<dt>New provider observation</dt>
										<dd>{formatCatalogEvidenceValue(detail.observedValue)}</dd>
									</div>
								</dl>
							</section>
						{/each}
					</div>
					<a
						href={`/profile/privileged-tools/catalog-review-work/products/${encodeURIComponent(change.sharedProductId)}`}
						>{change.correctionStatus === "linked"
							? "Review linked correction submission"
							: "Review product evidence and start correction"}</a
					>
					{#if change.correctionStatus === "linked"}
						<div class="catalog-review-work__decision-heading">
							<strong>A correction is already waiting for review</strong>
							<span>
								Approve it to create a new revision and resolve this
								observation. Reject it to keep the current product unchanged and
								return this observation for a better correction.
							</span>
						</div>
					{:else}
						<form
							method="POST"
							action="?/dismissProviderChange"
							use:enhance={enhanceReview}
						>
							<input type="hidden" name="reviewId" value={change.id} />
							<header class="catalog-review-work__decision-heading">
								<strong
									>Close this observation only if no correction is needed</strong
								>
								<span>
									Keep current rejects this observation, leaves every product
									value unchanged, and closes API conflicts created by this
									exact provider snapshot. Readiness is recalculated; unrelated
									blockers remain. If the provider evidence is stronger, leave
									it open and start a correction. Only approval creates a new
									revision.
								</span>
							</header>
							<TextField
								id={`provider-change-review-note-${change.id}`}
								name="reviewNote"
								label="Why should the current record stay?"
								placeholder="Describe the evidence supporting the current product."
								maxlength={2000}
								multiline
								rows={3}
								oninput={(event) =>
									(providerNoteByReviewId = {
										...providerNoteByReviewId,
										[change.id]: event.currentTarget.value,
									})}
								required
							/>
							<ActionButton
								type="submit"
								variant="success"
								size="small"
								busy={pendingReviewId === change.id}
								disabled={pendingReviewId !== null ||
									!providerNoteByReviewId[change.id]?.trim()}
								>Keep current record</ActionButton
							>
						</form>
					{/if}
				</article>
			{:else}
				<p class="catalog-review-work__empty">
					No provider changes need review.
				</p>
			{/each}
		</div>
	</CollapsibleSection>
</div>

<style lang="scss">
	@use "./CatalogReviewWorkDashboard.scss";
</style>
