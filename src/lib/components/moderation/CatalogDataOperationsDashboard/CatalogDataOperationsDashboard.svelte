<script lang="ts">
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import RoundedActionLink from "$lib/components/common/buttons/RoundedActionLink/RoundedActionLink.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import {
		getCatalogHealthStatusLabel,
		getCatalogIssueReasonLabel,
		getCatalogResolutionActionLabel,
	} from "$lib/utils/moderation/catalogHealthMessages";
	import type { CatalogDataOperationsDashboardProps } from "./types";

	let {
		dashboard,
		catalogMonitor,
		actionCount,
		actionSubjects,
		actionSubjectsTruncated,
	}: CatalogDataOperationsDashboardProps = $props();

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
	]);
	const diagnosticItems = $derived([
		{
			title: "Publication readiness",
			count: dashboard.issues.publication.length,
			description:
				"Products missing evidence or policy required for blendCalcAPI v1.",
			href: dashboard.issues.publication[0]
				? `/profile/privileged-tools/data-operations/products/${encodeURIComponent(dashboard.issues.publication[0].productId)}`
				: null,
			action: "Inspect first product",
		},
		{
			title: "Nutrient identity",
			count: dashboard.issues.nutrientMappings.length,
			description:
				"Source nutrients that must be mapped to the correct canonical nutrient.",
			href: dashboard.issues.nutrientMappings[0]
				? `/profile/privileged-tools/data-operations/nutrient-mappings/${encodeURIComponent(dashboard.issues.nutrientMappings[0].mappingId)}`
				: null,
			action: "Inspect first mapping",
		},
		{
			title: "Revision evidence",
			count: dashboard.issues.revisions.length,
			description:
				"Products whose revision history does not yet explain a recorded change.",
			href: dashboard.issues.revisions[0]
				? `/profile/privileged-tools/data-operations/products/${encodeURIComponent(dashboard.issues.revisions[0].productId)}`
				: null,
			action: "Inspect first revision",
		},
	]);
	const formatNumber = (value: number) => numberFormatter.format(value);
	const getSubjectTypeLabel = (subjectType: string) => {
		switch (subjectType) {
			case "shared_product":
				return "Catalog product";
			case "nutrient_mapping":
				return "Nutrient identity";
			case "generic_food_dataset":
				return "Dataset";
			case "product_data_source":
				return "Product source";
			case "food_preference":
				return "Food-warning policy";
			default:
				return "Data operation";
		}
	};
	const getDestinationLabel = (subjectType: string) => {
		if (subjectType === "nutrient_mapping") return "Review nutrient identity";
		if (subjectType === "generic_food_dataset") {
			return "Record dataset evidence";
		}
		return "Open product readiness";
	};
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
		class="catalog-data-operations__required-work"
		aria-labelledby="catalog-data-operations-required-work-title"
	>
		<header class="catalog-data-operations__section-heading">
			<div>
				<h2 id="catalog-data-operations-required-work-title">Required work</h2>
				<p>
					This is the same deduplicated workload shown in the Admin tools
					launcher.
				</p>
			</div>
		</header>
		{#if actionCount === null || actionSubjects === null}
			<article class="catalog-data-operations__required-card">
				<header>
					<strong>Queue status unavailable</strong>
					<TextBadge label="Unknown" tone="warning" />
				</header>
				<p>
					Use the diagnostic checks below, but do not treat a missing total as
					an all-clear.
				</p>
			</article>
		{:else if actionCount === 0}
			<article class="catalog-data-operations__required-card" data-clear="true">
				<header>
					<strong>No tracked operator work</strong>
					<TextBadge label="Clear" tone="success" />
				</header>
				<p>
					No enabled data-operations issue currently needs a person. The
					diagnostics below remain available for investigation.
				</p>
			</article>
		{:else}
			<div class="catalog-data-operations__required-list">
				{#each actionSubjects as subject (`${subject.subjectType}:${subject.subjectKey}`)}
					<article
						class="catalog-data-operations__required-card"
						data-severity={subject.severity}
					>
						<header>
							<div>
								<span class="catalog-data-operations__required-type">
									{getSubjectTypeLabel(subject.subjectType)}
								</span>
								<strong>{subject.displayName}</strong>
								{#if subject.context}
									<small>{subject.context}</small>
								{/if}
							</div>
							<TextBadge
								label={`${formatNumber(subject.issueCount)} ${subject.issueCount === 1 ? "finding" : "findings"}`}
								tone="warning"
							/>
						</header>
						<ul aria-label={`Findings for ${subject.displayName}`}>
							{#each subject.issues as issue}
								<li>
									<strong>{issue.summary}</strong>
									<span>
										Next: {getCatalogResolutionActionLabel(
											issue.resolutionAction,
										)}
									</span>
								</li>
							{/each}
						</ul>
						{#if subject.destination}
							<div class="catalog-data-operations__required-action">
								<strong>What happens next</strong>
								<p>
									Opening the focused review changes nothing. It shows the
									evidence and enables only the decisions or repairs supported
									for this subject.
								</p>
								<RoundedActionLink
									href={subject.destination}
									variant="primary"
									fullWidth
								>
									{getDestinationLabel(subject.subjectType)}
								</RoundedActionLink>
							</div>
						{:else}
							<div
								class="catalog-data-operations__required-action"
								data-unavailable="true"
							>
								<strong>Cannot finish this in the app yet</strong>
								<p>{subject.missingPrerequisite}</p>
								<p>
									Nothing changes until that workflow records reviewed evidence.
								</p>
							</div>
						{/if}
					</article>
				{/each}
				{#if actionSubjectsTruncated}
					<p class="catalog-data-operations__required-limit" role="status">
						Showing the first {formatNumber(actionSubjects.length)} of {formatNumber(
							actionCount,
						)} named subjects. Finish or repair these first, then refresh for the
						next batch.
					</p>
				{/if}
			</div>
		{/if}
	</section>

	<section
		class="catalog-data-operations__overview"
		aria-label="Catalog coverage"
	>
		{#each operationalOverviewItems as item (item.label)}
			<article>
				<TextBadge label={formatNumber(item.value)} tone={item.tone} />
				<span>{item.label}</span>
			</article>
		{/each}
	</section>

	<section
		class="catalog-data-operations__action-queues"
		aria-labelledby="catalog-data-operations-diagnostics-title"
	>
		<header class="catalog-data-operations__section-heading">
			<div>
				<h2 id="catalog-data-operations-diagnostics-title">
					Diagnostic checks
				</h2>
				<p>
					These broader checks can overlap. Use them to investigate the required
					work above; they do not add to the red action total.
				</p>
			</div>
		</header>
		<div class="catalog-data-operations__action-grid">
			{#each diagnosticItems as item (item.title)}
				<article
					class="catalog-data-operations__action-card"
					data-clear={item.count === 0}
				>
					<header>
						<strong>{item.title}</strong>
						<TextBadge
							label={item.count === 0
								? "Clear"
								: `${formatNumber(item.count)} ${item.count === 1 ? "match" : "matches"}`}
							tone={item.count === 0 ? "success" : "warning"}
						/>
					</header>
					<p>{item.description}</p>
					{#if item.href}
						<a href={item.href}>{item.action}</a>
					{:else}
						<span class="catalog-data-operations__clear-label"
							>No diagnostic matches</span
						>
					{/if}
				</article>
			{/each}
		</div>
	</section>

	<header
		class="catalog-data-operations__section-heading catalog-data-operations__section-heading--details"
	>
		<div>
			<h2>Details and system health</h2>
			<p>
				Open these sections for diagnostics, evidence, and the full queue lists.
			</p>
		</div>
	</header>

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
			badge={`${dashboard.sources.length} ${dashboard.sources.length === 1 ? "source" : "sources"}`}
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
			badge={`${dashboard.datasets.length} ${dashboard.datasets.length === 1 ? "dataset" : "datasets"}`}
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
							{#if dataset.importEnabled}
								<a
									href={`/profile/privileged-tools/data-operations/datasets/${encodeURIComponent(dataset.key)}`}
									>Review import evidence</a
								>
							{/if}
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
			badge={dashboard.issues.publication.length === 0
				? "Clear"
				: `${dashboard.issues.publication.length} ${dashboard.issues.publication.length === 1 ? "match" : "matches"}`}
			tone={dashboard.issues.publication.length > 0 ? "warning" : "neutral"}
			open={dashboard.issues.publication.length > 0}
			surface="panel"
		>
			<div class="catalog-data-operations__stack">
				{#each dashboard.issues.publication as issue (issue.productId)}
					<article class="catalog-data-operations__issue-record">
						<div>
							<strong>{issue.productName}</strong><span>{issue.barcode}</span>
						</div>
						<ul>
							{#each issue.reasonDetails as reason}<li>
									{getCatalogIssueReasonLabel(reason.reason, reason.parameters)}
								</li>{/each}
						</ul>
						<a
							href={`/profile/privileged-tools/data-operations/products/${encodeURIComponent(issue.productId)}`}
							>Review publication evidence</a
						>
					</article>
				{:else}<p class="catalog-data-operations__empty">
						No product needs publication-readiness action. Products with a
						finished accepted-withheld review remain out of public blendCalcAPI
						v1 until their evidence changes.
					</p>{/each}
			</div>
		</CollapsibleSection>

		<CollapsibleSection
			title="Nutrient mapping gaps"
			badge={dashboard.issues.nutrientMappings.length === 0
				? "Clear"
				: `${dashboard.issues.nutrientMappings.length} ${dashboard.issues.nutrientMappings.length === 1 ? "match" : "matches"}`}
			tone={dashboard.issues.nutrientMappings.length > 0
				? "warning"
				: "neutral"}
			open={dashboard.issues.publication.length === 0 &&
				dashboard.issues.nutrientMappings.length > 0}
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
			badge={dashboard.issues.revisions.length === 0
				? "Clear"
				: `${dashboard.issues.revisions.length} ${dashboard.issues.revisions.length === 1 ? "match" : "matches"}`}
			tone={dashboard.issues.revisions.length > 0 ? "warning" : "neutral"}
			open={dashboard.issues.publication.length === 0 &&
				dashboard.issues.nutrientMappings.length === 0 &&
				dashboard.issues.revisions.length > 0}
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
