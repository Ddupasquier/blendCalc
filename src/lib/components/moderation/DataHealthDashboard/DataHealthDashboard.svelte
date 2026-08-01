<script lang="ts">
	import PrivilegedActionBadge from "$lib/components/common/badges/PrivilegedActionBadge/PrivilegedActionBadge.svelte";
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import type { DataHealthDashboardProps } from "./types";

	let { dashboard, viewerRole }: DataHealthDashboardProps = $props();

	const numberFormatter = new Intl.NumberFormat();
	const dateFormatter = new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	});

	const overviewItems = $derived([
		{ label: "Active products", value: dashboard.overview.activeProducts, tone: "neutral" as const },
		{ label: "API-ready products", value: dashboard.overview.publicationReadyProducts, tone: "success" as const },
		{ label: "Open catalog conflicts", value: dashboard.overview.unresolvedConflicts, tone: "info" as const },
		{ label: "Product submissions", value: dashboard.overview.pendingProductSubmissions, tone: "info" as const },
		{ label: "Food warning reports", value: dashboard.overview.pendingCompatibilityReports, tone: "info" as const },
		{ label: "Preference mappings", value: dashboard.overview.pendingPreferenceMappings, tone: "info" as const },
		{ label: "Nutrient mapping gaps", value: dashboard.overview.nutrientMappingReviewGaps, tone: "neutral" as const },
		{ label: "Revision history gaps", value: dashboard.overview.revisionHistoryGaps, tone: "neutral" as const },
		{ label: "Dataset review gaps", value: dashboard.overview.datasetReviewGaps, tone: "neutral" as const },
		{ label: "Source policy gaps", value: dashboard.overview.sourcePolicyGaps, tone: "neutral" as const },
		{ label: "Food policy coverage gaps", value: dashboard.overview.compatibilityCoverageGaps, tone: "neutral" as const },
	]);

	const formatNumber = (value: number) => numberFormatter.format(value);
	const formatDate = (value: string | null) => {
		if (!value) return "Not recorded";
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? "Not recorded" : dateFormatter.format(date);
	};
	const formatIssue = (value: string) =>
		value.replaceAll("_", " ").replace(/^./u, (letter) => letter.toLocaleUpperCase());
</script>

<section class="data-health" aria-labelledby="data-health-title">
	<header class="data-health__header">
		<div>
			<p class="data-health__eyebrow">{viewerRole} tools</p>
			<h1 id="data-health-title">Catalog data health</h1>
			<p>
				Review bounded catalog, source, import, mapping, and policy summaries without
				exposing private evidence or raw provider responses.
			</p>
		</div>
		<PrivilegedActionBadge label="Moderator data health" />
	</header>

	<p class="data-health__generated">
		Updated {formatDate(dashboard.generatedAt)} · Source activity covers the last
		{dashboard.metricWindowDays} days.
	</p>

	<section class="data-health__overview" aria-label="Data health overview">
		{#each overviewItems as item (item.label)}
			<article>
				<TextBadge label={formatNumber(item.value)} tone={item.tone} />
				<span>{item.label}</span>
			</article>
		{/each}
	</section>

	<nav class="data-health__queue-links" aria-label="Moderation queues">
		<a href="/moderation#product-review">Review product submissions</a>
		<a href="/moderation#compatibility-review">Review food warning reports</a>
	</nav>

	<div class="data-health__sections">
		<CollapsibleSection title="Source activity" badge={`${dashboard.sources.length}`} surface="panel">
			<div class="data-health__stack">
				{#each dashboard.sources as source (source.key)}
					<article class="data-health__record">
						<header>
							<div>
								<strong>{source.displayName}</strong>
								<span>{source.sourceType.replaceAll("_", " ")}</span>
							</div>
							<TextBadge label={source.enabled ? "Enabled" : "Paused"} tone={source.enabled ? "success" : "neutral"} />
						</header>
						<dl class="data-health__metrics">
							<div><dt>Lookups</dt><dd>{formatNumber(source.metrics.lookups)}</dd></div>
							<div><dt>API requests</dt><dd>{formatNumber(source.metrics.apiRequests)}</dd></div>
							<div><dt>Cache hits</dt><dd>{formatNumber(source.metrics.cacheHits)}</dd></div>
							<div><dt>API errors</dt><dd>{formatNumber(source.metrics.apiErrors)}</dd></div>
							<div><dt>Exact barcode matches</dt><dd>{formatNumber(source.metrics.exactBarcodeMatches)}</dd></div>
							<div><dt>Average response</dt><dd>{source.metrics.averageResponseMilliseconds === null ? "No sample" : `${formatNumber(source.metrics.averageResponseMilliseconds)} ms`}</dd></div>
						</dl>
						{#if source.policyIssues.length > 0}
							<ul class="data-health__issues">
								{#each source.policyIssues as issue}<li>{formatIssue(issue)}</li>{/each}
							</ul>
						{/if}
						{#if source.latestEvaluation}
							<div class="data-health__evaluation">
								<strong>Latest evaluation: {source.latestEvaluation.decision}</strong>
								<p>{source.latestEvaluation.summary}</p>
								<span>{formatDate(source.latestEvaluation.evaluatedAt)} · {formatNumber(source.latestEvaluation.usableCount)} usable of {formatNumber(source.latestEvaluation.sampleSize)} sampled</span>
								{#if source.latestEvaluation.evidenceUrl}
									<a href={source.latestEvaluation.evidenceUrl} target="_blank" rel="noreferrer">Open evaluation reference</a>
								{/if}
							</div>
						{/if}
					</article>
				{:else}
					<p class="data-health__empty">No source activity is available.</p>
				{/each}
			</div>
		</CollapsibleSection>

		<CollapsibleSection title="Dataset imports & licensing" badge={`${dashboard.datasets.length}`} surface="panel">
			<div class="data-health__stack">
				{#each dashboard.datasets as dataset (dataset.key)}
					<article class="data-health__record">
						<header>
							<div>
								<strong>{dataset.displayName}</strong>
								<span>{dataset.version}{dataset.regionCode ? ` · ${dataset.regionCode}` : ""}</span>
							</div>
							<TextBadge label={dataset.licenseReviewStatus} tone={dataset.licenseReviewStatus === "approved" ? "success" : "neutral"} />
						</header>
						<dl class="data-health__metrics">
							<div><dt>Foods</dt><dd>{formatNumber(dataset.foodCount)}</dd></div>
							<div><dt>Nutrients</dt><dd>{formatNumber(dataset.nutrientValueCount)}</dd></div>
							<div><dt>Measures</dt><dd>{formatNumber(dataset.measureCount)}</dd></div>
							<div><dt>Imported</dt><dd>{formatDate(dataset.importedAt)}</dd></div>
							<div><dt>Checksum</dt><dd>{dataset.checksumRecorded ? "Recorded" : "Missing"}</dd></div>
							<div><dt>License</dt><dd>{dataset.licenseName}</dd></div>
						</dl>
						{#if dataset.issues.length > 0}
							<ul class="data-health__issues">
								{#each dataset.issues as issue}<li>{formatIssue(issue)}</li>{/each}
							</ul>
						{/if}
					</article>
				{/each}
			</div>
		</CollapsibleSection>

		<CollapsibleSection title="Food warning policy" badge={dashboard.policy.version === null ? "No active version" : `v${dashboard.policy.version}`} surface="panel">
			<article class="data-health__record">
				<dl class="data-health__metrics">
					<div><dt>Effective</dt><dd>{formatDate(dashboard.policy.effectiveAt)}</dd></div>
					<div><dt>Reviewed</dt><dd>{formatDate(dashboard.policy.reviewedAt)}</dd></div>
					<div><dt>Source references</dt><dd>{formatNumber(dashboard.policy.sourceReferenceCount)}</dd></div>
					<div><dt>Selectable settings</dt><dd>{formatNumber(dashboard.policy.selectablePreferenceCount)}</dd></div>
					<div><dt>Coverage gaps</dt><dd>{formatNumber(dashboard.policy.coverageGapCount)}</dd></div>
					<div><dt>Pending mappings</dt><dd>{formatNumber(dashboard.policy.pendingPreferenceMappingCount)}</dd></div>
				</dl>
				{#if dashboard.policy.changeSummary}<p>{dashboard.policy.changeSummary}</p>{/if}
			</article>
		</CollapsibleSection>

		<CollapsibleSection title="Catalog conflicts" badge={`${dashboard.issues.conflicts.length}`} surface="panel">
			<div class="data-health__stack">
				{#each dashboard.issues.conflicts as issue (issue.id)}
					<article class="data-health__issue-record">
						<div><strong>{issue.productName}</strong><span>{issue.barcode}</span></div>
						<p>{formatIssue(issue.fieldPath)} · {formatIssue(issue.severity)}</p>
						<a href={`/api/moderation/catalog/products/${encodeURIComponent(issue.productId)}/provenance`} target="_blank" rel="noreferrer">Review field provenance</a>
					</article>
				{:else}<p class="data-health__empty">No open catalog conflicts.</p>{/each}
			</div>
		</CollapsibleSection>

		<CollapsibleSection title="API publication gaps" badge={`${dashboard.issues.publication.length}`} surface="panel">
			<div class="data-health__stack">
				{#each dashboard.issues.publication as issue (issue.productId)}
					<article class="data-health__issue-record">
						<div><strong>{issue.productName}</strong><span>{issue.barcode}</span></div>
						<ul>{#each issue.reasons as reason}<li>{formatIssue(reason)}</li>{/each}</ul>
						<a href={`/api/moderation/catalog/products/${encodeURIComponent(issue.productId)}/provenance`} target="_blank" rel="noreferrer">Review publication evidence</a>
					</article>
				{:else}<p class="data-health__empty">Every active product is ready for the internal API.</p>{/each}
			</div>
		</CollapsibleSection>

		<CollapsibleSection title="Nutrient mapping review" badge={`${dashboard.issues.nutrientMappings.length}`} surface="panel">
			<div class="data-health__stack">
				{#each dashboard.issues.nutrientMappings as issue (`${issue.sourceKey}:${issue.sourceNutrientKey}:${issue.sourceUnitName}`)}
					<article class="data-health__issue-record">
						<div><strong>{issue.sourceNutrientName ?? issue.sourceNutrientKey}</strong><span>{issue.sourceKey}</span></div>
						<p>{issue.sourceUnitName} · {formatIssue(issue.reviewStatus)}</p>
					</article>
				{:else}<p class="data-health__empty">No nutrient mappings need review.</p>{/each}
			</div>
		</CollapsibleSection>

		<CollapsibleSection title="Revision history gaps" badge={`${dashboard.issues.revisions.length}`} surface="panel">
			<div class="data-health__stack">
				{#each dashboard.issues.revisions as issue (issue.productId)}
					<article class="data-health__issue-record">
						<div><strong>{issue.productName}</strong><span>{issue.barcode}</span></div>
						<p>{formatIssue(issue.issue)}</p>
						<a href={`/api/moderation/catalog/products/${encodeURIComponent(issue.productId)}/provenance`} target="_blank" rel="noreferrer">Review revision evidence</a>
					</article>
				{:else}<p class="data-health__empty">No revision history gaps were found.</p>{/each}
			</div>
		</CollapsibleSection>
	</div>
</section>

<style lang="scss">
	@use "./DataHealthDashboard.scss";
</style>
