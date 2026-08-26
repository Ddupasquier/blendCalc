<script lang="ts">
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import {
		getCatalogHealthStatusLabel,
		getCatalogIssueReasonLabel,
	} from "$lib/utils/moderation/catalogHealthMessages";
	import type { CatalogDataOperationsDashboardProps } from "./types";

	let { dashboard, catalogMonitor }: CatalogDataOperationsDashboardProps =
		$props();

	const numberFormatter = new Intl.NumberFormat();
	const dateFormatter = new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	});

	const operationalOverviewItems = $derived([
		{
			label: "Products available in blendCalc",
			value: dashboard.overview.activeProducts,
			tone: "success" as const,
		},
		{
			label: "Products ready for blendCalcAPI v1",
			value: dashboard.overview.publicationReadyProducts,
			tone: "success" as const,
		},
		{
			label: "blendCalcAPI publication gaps",
			value: dashboard.issues.publication.length,
			tone: "neutral" as const,
		},
		{
			label: "Nutrient mappings to resolve",
			value: dashboard.issues.nutrientMappings.length,
			tone: "neutral" as const,
		},
		{
			label: "Revision history gaps",
			value: dashboard.issues.revisions.length,
			tone: "neutral" as const,
		},
	]);

	const formatNumber = (value: number) => numberFormatter.format(value);
	const formatDate = (value: string | null) => {
		if (!value) return "Not recorded";
		const date = new Date(value);
		return Number.isNaN(date.getTime())
			? "Not recorded"
			: dateFormatter.format(date);
	};
</script>

<section class="catalog-data-operations" aria-label="Catalog data operations">
	<p class="catalog-data-operations__generated">
		Updated {formatDate(dashboard.generatedAt)} · Source activity covers the last
		{dashboard.metricWindowDays} days.
	</p>

	<section
		class="catalog-data-operations__overview"
		aria-label="Operational overview"
	>
		{#each operationalOverviewItems as item (item.label)}
			<article>
				<TextBadge label={formatNumber(item.value)} tone={item.tone} />
				<span>{item.label}</span>
			</article>
		{/each}
	</section>

	<div class="catalog-data-operations__sections">
		<CollapsibleSection
			title="Automated catalog monitoring"
			badge={catalogMonitor.settings.enabled ? "Running" : "Paused"}
			surface="panel"
		>
			<div class="catalog-data-operations__stack">
				<article class="catalog-data-operations__record">
					<header>
						<div>
							<strong>Scheduled evidence checks</strong>
							<span
								>Product changes and official safety notices are collected
								without silently replacing catalog facts.</span
							>
						</div>
						<TextBadge
							label={catalogMonitor.settings.enabled ? "Enabled" : "Disabled"}
							tone={catalogMonitor.settings.enabled ? "success" : "neutral"}
						/>
					</header>
					<dl class="catalog-data-operations__metrics">
						<div>
							<dt>Product batch</dt>
							<dd>{formatNumber(catalogMonitor.settings.productBatchSize)}</dd>
						</div>
						<div>
							<dt>Alert page</dt>
							<dd>
								{formatNumber(catalogMonitor.settings.safetyAlertPageSize)}
							</dd>
						</div>
						<div>
							<dt>Products due</dt>
							<dd>{formatNumber(catalogMonitor.queue.dueProducts)}</dd>
						</div>
						<div>
							<dt>Products retrying</dt>
							<dd>{formatNumber(catalogMonitor.queue.retryingProducts)}</dd>
						</div>
						<div>
							<dt>Last request</dt>
							<dd>
								{formatDate(catalogMonitor.settings.lastInvocationRequestedAt)}
							</dd>
						</div>
						<div>
							<dt>Last request error</dt>
							<dd>{catalogMonitor.settings.lastInvocationError ?? "None"}</dd>
						</div>
					</dl>
				</article>
				{#each catalogMonitor.recentRuns as run (run.id)}
					<article class="catalog-data-operations__issue-record">
						<div>
							<strong>{formatDate(run.startedAt)}</strong>
							<TextBadge
								label={getCatalogHealthStatusLabel(run.status)}
								tone={run.status === "completed" ? "success" : "neutral"}
							/>
						</div>
						<p>
							{formatNumber(run.productJobsClaimed)} products · {formatNumber(
								run.productJobsChanged,
							)} changed · {formatNumber(run.safetyAlertsObserved)} alerts · {formatNumber(
								run.safetyMatchesActivated,
							)} matches
						</p>
					</article>
				{:else}
					<p class="catalog-data-operations__empty">
						No monitoring run has been recorded yet.
					</p>
				{/each}
			</div>
		</CollapsibleSection>

		<CollapsibleSection
			title="Source activity"
			badge={`${dashboard.sources.length}`}
			surface="panel"
		>
			<div class="catalog-data-operations__stack">
				<p class="catalog-data-operations__muted">
					Most-used sources appear first, based on lookups during this {dashboard.metricWindowDays}-day
					window.
				</p>
				{#each dashboard.sources as source (source.key)}
					<article class="catalog-data-operations__record">
						<header>
							<div>
								<strong>{source.displayName}</strong>
								<span
									>{source.enabled
										? "Available for lookups"
										: "Not used for lookups"}</span
								>
							</div>
							<TextBadge
								label={source.enabled ? "Enabled" : "Paused"}
								tone={source.enabled ? "success" : "neutral"}
							/>
						</header>
						<dl class="catalog-data-operations__metrics">
							<div>
								<dt>Lookups</dt>
								<dd>{formatNumber(source.metrics.lookups)}</dd>
							</div>
							<div>
								<dt>API requests</dt>
								<dd>{formatNumber(source.metrics.apiRequests)}</dd>
							</div>
							<div>
								<dt>Cache hits</dt>
								<dd>{formatNumber(source.metrics.cacheHits)}</dd>
							</div>
							<div>
								<dt>API errors</dt>
								<dd>{formatNumber(source.metrics.apiErrors)}</dd>
							</div>
							<div>
								<dt>Exact barcode matches</dt>
								<dd>{formatNumber(source.metrics.exactBarcodeMatches)}</dd>
							</div>
							<div>
								<dt>Average response</dt>
								<dd>
									{source.metrics.averageResponseMilliseconds === null
										? "No sample"
										: `${formatNumber(source.metrics.averageResponseMilliseconds)} ms`}
								</dd>
							</div>
						</dl>
						{#if source.policyIssues.length > 0}
							<ul class="catalog-data-operations__issues">
								{#each source.policyIssues as issue}<li>
										{getCatalogIssueReasonLabel(issue)}
									</li>{/each}
							</ul>
						{/if}
						{#if source.latestEvaluation}
							<div class="catalog-data-operations__evaluation">
								<strong
									>Latest evaluation: {getCatalogHealthStatusLabel(
										source.latestEvaluation.decision,
									)}</strong
								>
								<p>{source.latestEvaluation.summary}</p>
								<span
									>{formatDate(source.latestEvaluation.evaluatedAt)} · {formatNumber(
										source.latestEvaluation.usableCount,
									)} usable of {formatNumber(
										source.latestEvaluation.sampleSize,
									)} sampled</span
								>
								{#if source.latestEvaluation.evidenceUrl}
									<a
										href={source.latestEvaluation.evidenceUrl}
										target="_blank"
										rel="noreferrer">Open evaluation reference</a
									>
								{/if}
							</div>
						{/if}
					</article>
				{:else}
					<p class="catalog-data-operations__empty">
						No source activity is available.
					</p>
				{/each}
			</div>
		</CollapsibleSection>

		<CollapsibleSection
			title="Dataset imports and licensing"
			badge={`${dashboard.datasets.length}`}
			surface="panel"
		>
			<div class="catalog-data-operations__stack">
				{#each dashboard.datasets as dataset (dataset.key)}
					<article class="catalog-data-operations__record">
						<header>
							<div>
								<strong>{dataset.displayName}</strong>
								<span
									>{dataset.version}{dataset.regionCode
										? ` · ${dataset.regionCode}`
										: ""}</span
								>
							</div>
							<TextBadge
								label={getCatalogHealthStatusLabel(dataset.licenseReviewStatus)}
								tone={dataset.licenseReviewStatus === "approved"
									? "success"
									: "neutral"}
							/>
						</header>
						<dl class="catalog-data-operations__metrics">
							<div>
								<dt>Foods</dt>
								<dd>{formatNumber(dataset.foodCount)}</dd>
							</div>
							<div>
								<dt>Nutrients</dt>
								<dd>{formatNumber(dataset.nutrientValueCount)}</dd>
							</div>
							<div>
								<dt>Measures</dt>
								<dd>{formatNumber(dataset.measureCount)}</dd>
							</div>
							<div>
								<dt>Imported</dt>
								<dd>{formatDate(dataset.importedAt)}</dd>
							</div>
							<div>
								<dt>Checksum</dt>
								<dd>{dataset.checksumRecorded ? "Recorded" : "Missing"}</dd>
							</div>
							<div>
								<dt>License</dt>
								<dd>{dataset.licenseName}</dd>
							</div>
						</dl>
						{#if dataset.issues.length > 0}
							<ul class="catalog-data-operations__issues">
								{#each dataset.issues as issue}<li>
										{getCatalogIssueReasonLabel(issue)}
									</li>{/each}
							</ul>
						{/if}
					</article>
				{/each}
			</div>
		</CollapsibleSection>

		<CollapsibleSection
			title="Food warning policy"
			badge={dashboard.policy.version === null
				? "No active version"
				: `v${dashboard.policy.version}`}
			surface="panel"
		>
			<article class="catalog-data-operations__record">
				<dl class="catalog-data-operations__metrics">
					<div>
						<dt>Effective</dt>
						<dd>{formatDate(dashboard.policy.effectiveAt)}</dd>
					</div>
					<div>
						<dt>Reviewed</dt>
						<dd>{formatDate(dashboard.policy.reviewedAt)}</dd>
					</div>
					<div>
						<dt>Source references</dt>
						<dd>{formatNumber(dashboard.policy.sourceReferenceCount)}</dd>
					</div>
					<div>
						<dt>Selectable settings</dt>
						<dd>{formatNumber(dashboard.policy.selectablePreferenceCount)}</dd>
					</div>
					<div>
						<dt>Coverage gaps</dt>
						<dd>{formatNumber(dashboard.policy.coverageGapCount)}</dd>
					</div>
					<div>
						<dt>Pending mappings</dt>
						<dd>
							{formatNumber(dashboard.policy.pendingPreferenceMappingCount)}
						</dd>
					</div>
				</dl>
				{#if dashboard.policy.changeSummary}<p>
						{dashboard.policy.changeSummary}
					</p>{/if}
			</article>
		</CollapsibleSection>

		<CollapsibleSection
			title="blendCalcAPI publication gaps"
			badge={`${dashboard.issues.publication.length}`}
			surface="panel"
		>
			<div class="catalog-data-operations__stack">
				{#each dashboard.issues.publication as issue (issue.productId)}
					<article class="catalog-data-operations__issue-record">
						<div>
							<strong>{issue.productName}</strong><span>{issue.barcode}</span>
						</div>
						<ul>
							{#each issue.reasons as reason}<li>
									{getCatalogIssueReasonLabel(reason)}
								</li>{/each}
						</ul>
						<a
							href={`/profile/privileged-tools/data-operations/products/${encodeURIComponent(issue.productId)}`}
							>Review publication evidence</a
						>
					</article>
				{:else}<p class="catalog-data-operations__empty">
						Every active product is ready for blendCalcAPI v1.
					</p>{/each}
			</div>
		</CollapsibleSection>

		<CollapsibleSection
			title="Nutrient mapping gaps"
			badge={`${dashboard.issues.nutrientMappings.length}`}
			surface="panel"
		>
			<div class="catalog-data-operations__stack">
				{#each dashboard.issues.nutrientMappings as issue (issue.mappingId)}
					<article class="catalog-data-operations__issue-record">
						<div>
							<strong
								>{issue.sourceNutrientName ?? issue.sourceNutrientKey}</strong
							><span>{issue.sourceKey}</span>
						</div>
						<p>
							{issue.sourceUnitName} · {getCatalogHealthStatusLabel(
								issue.reviewStatus,
							)}
						</p>
						<a
							href={`/profile/privileged-tools/data-operations/nutrient-mappings/${encodeURIComponent(issue.mappingId)}`}
							>Review nutrient identity</a
						>
					</article>
				{:else}<p class="catalog-data-operations__empty">
						No nutrient mappings need attention.
					</p>{/each}
			</div>
		</CollapsibleSection>

		<CollapsibleSection
			title="Revision history gaps"
			badge={`${dashboard.issues.revisions.length}`}
			surface="panel"
		>
			<div class="catalog-data-operations__stack">
				{#each dashboard.issues.revisions as issue (issue.productId)}
					<article class="catalog-data-operations__issue-record">
						<div>
							<strong>{issue.productName}</strong><span>{issue.barcode}</span>
						</div>
						<p>{getCatalogIssueReasonLabel(issue.issue)}</p>
						<a
							href={`/profile/privileged-tools/data-operations/products/${encodeURIComponent(issue.productId)}`}
							>Review revision evidence</a
						>
					</article>
				{:else}<p class="catalog-data-operations__empty">
						No revision history gaps were found.
					</p>{/each}
			</div>
		</CollapsibleSection>
	</div>
</section>

<style lang="scss">
	@use "./CatalogDataOperationsDashboard.scss";
</style>
