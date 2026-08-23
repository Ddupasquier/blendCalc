<script lang="ts">
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import {
		getCatalogHealthStatusLabel,
		getCatalogIssueCodeLabel,
		getCatalogIssueReasonLabel,
		getCatalogResolutionActionLabel,
		getCatalogResponsibleGroupLabel,
	} from "$lib/utils/moderation/catalogHealthMessages";
	import type { CatalogProductReadinessPassportProps } from "./types";

	let { passport }: CatalogProductReadinessPassportProps = $props();

	const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
	const formatDate = (value: string | null) => {
		if (!value) return "Not recorded";
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? "Not recorded" : dateFormatter.format(date);
	};
	const formatEvidenceCoverage = (covered: number, total: number) =>
		total === 0 ? "No records" : `${covered} of ${total}`;
	const statusTone = (ready: boolean) => ready ? "success" as const : "warning" as const;
	const issueTone = $derived(
		passport.issues.some((issue) => ["critical", "blocking"].includes(issue.operationalSeverity))
			? "danger" as const
			: "warning" as const,
	);
</script>

<article class="catalog-product-passport">
	<header class="catalog-product-passport__identity">
		<div>
			<h2>{passport.product.productName}</h2>
			<p>{passport.product.brandOwner ?? "Brand not reported"} · {passport.product.barcode}</p>
		</div>
		<TextBadge
			label={getCatalogHealthStatusLabel(passport.product.sharedCatalogStatus.toLocaleLowerCase().replaceAll(" ", "_"))}
			tone={statusTone(passport.product.usableInBlendcalc)}
		/>
	</header>

	<section class="catalog-product-passport__availability" aria-label="Product availability">
		<article>
			<span>blendCalc search</span>
			<strong>{passport.product.searchableInBlendcalc ? "Available" : "Unavailable"}</strong>
		</article>
		<article>
			<span>blendCalc use</span>
			<strong>{passport.product.usableInBlendcalc ? "Available" : "Unavailable"}</strong>
		</article>
		<article>
			<span>Public API v1</span>
			<strong>{passport.product.apiV1Status}</strong>
		</article>
	</section>

	{#if passport.issues.length > 0}
		<CollapsibleSection
			title="What needs attention"
			badge={`${passport.issues.length}`}
			open
			surface="panel"
			tone={issueTone}
		>
			<div class="catalog-product-passport__issue-list">
				{#each passport.issues as issue (issue.occurrenceKey)}
					<article class="catalog-product-passport__issue">
						<header>
							<strong>{getCatalogIssueCodeLabel(issue.issueCode)}</strong>
							<TextBadge
								label={getCatalogHealthStatusLabel(issue.operationalSeverity)}
								tone="warning"
							/>
						</header>
						<p>{getCatalogIssueReasonLabel(issue.sourceReason)}</p>
						<dl>
							<div><dt>Owner</dt><dd>{getCatalogResponsibleGroupLabel(issue.responsibleGroup)}</dd></div>
							<div><dt>Next step</dt><dd>{getCatalogResolutionActionLabel(issue.resolutionAction)}</dd></div>
							<div><dt>Detected</dt><dd>{formatDate(issue.detectedAt)}</dd></div>
							<div><dt>Automatic repair</dt><dd>{issue.automatedRepairAllowed ? "Eligible after a reviewed dry run" : "Human evidence required"}</dd></div>
						</dl>
					</article>
				{/each}
			</div>
		</CollapsibleSection>
	{:else}
		<p class="catalog-product-passport__ready-message">
			No current catalog-health issues were found for this product.
		</p>
	{/if}

	<CollapsibleSection title="Revision and verification" surface="panel">
		<dl class="catalog-product-passport__details">
			<div><dt>Current revision</dt><dd>{passport.revision ? `Revision ${passport.revision.number}` : "Missing"}</dd></div>
			<div><dt>Label observed</dt><dd>{formatDate(passport.revision?.labelObservedAt ?? null)}</dd></div>
			<div><dt>Revision created</dt><dd>{formatDate(passport.revision?.createdAt ?? null)}</dd></div>
			<div><dt>Last verified</dt><dd>{formatDate(passport.product.lastVerifiedAt)}</dd></div>
			<div><dt>Pending corrections</dt><dd>{passport.product.pendingCorrectionCount}</dd></div>
			<div><dt>Open material conflicts</dt><dd>{passport.product.openMaterialConflictCount}</dd></div>
		</dl>
	</CollapsibleSection>

	<CollapsibleSection title="Evidence coverage" surface="panel">
		<dl class="catalog-product-passport__details">
			<div><dt>Selected product fields</dt><dd>{passport.evidence.selectedFieldCount}</dd></div>
			<div><dt>Nutrition with source evidence</dt><dd>{formatEvidenceCoverage(passport.evidence.nutrientsWithSourceEvidenceCount, passport.evidence.normalizedNutrientCount)}</dd></div>
			<div><dt>Servings with source evidence</dt><dd>{formatEvidenceCoverage(passport.evidence.servingsWithSourceEvidenceCount, passport.evidence.servingCount)}</dd></div>
			<div><dt>Stored observations</dt><dd>{passport.evidence.observationCount}</dd></div>
		</dl>
		{#if passport.evidence.sources.length > 0}
			<p class="catalog-product-passport__sources">
				<strong>Evidence sources:</strong> {passport.evidence.sources.join(", ")}
			</p>
		{/if}
	</CollapsibleSection>

	<CollapsibleSection title="API publication checks" surface="panel">
		<p class="catalog-product-passport__supporting-copy">
			The API status is evaluated separately from whether this product remains useful inside blendCalc.
		</p>
		<dl class="catalog-product-passport__details">
			<div><dt>API v1 status</dt><dd>{passport.product.apiV1Status}</dd></div>
			<div><dt>Catalog status</dt><dd>{passport.product.sharedCatalogStatus}</dd></div>
			<div><dt>Quality checks recorded</dt><dd>{Object.keys(passport.qualityDimensions).length}</dd></div>
		</dl>
	</CollapsibleSection>
</article>

<style lang="scss">
	@use "./CatalogProductReadinessPassport.scss";
</style>
