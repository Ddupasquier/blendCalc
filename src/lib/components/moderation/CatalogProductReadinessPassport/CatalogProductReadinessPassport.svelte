<script lang="ts">
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import RoundedActionLink from "$lib/components/common/buttons/RoundedActionLink/RoundedActionLink.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import { getCatalogHealthRepairTargetId } from "$lib/utils/moderation/catalogHealthRepair";
	import {
		getCatalogHealthStatusLabel,
		getCatalogIssueDisplayTitle,
		getCatalogIssueImpactLabel,
		getCatalogIssueReasonLabel,
		getCatalogResolutionActionLabel,
		getCatalogResponsibleGroupLabel,
	} from "$lib/utils/moderation/catalogHealthMessages";
	import { focusPrivilegedWorkspaceTarget } from "$lib/utils/moderation/privilegedWorkspaceNavigation";
	import type { CatalogProductReadinessPassportProps } from "./types";

	let {
		passport,
		canRunRepairs = false,
		correctionWorkflowAvailable = false,
	}: CatalogProductReadinessPassportProps = $props();

	const dateFormatter = new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
	});
	const formatDate = (value: string | null) => {
		if (!value) return "Not recorded";
		const date = new Date(value);
		return Number.isNaN(date.getTime())
			? "Not recorded"
			: dateFormatter.format(date);
	};
	const formatEvidenceCoverage = (covered: number, total: number) =>
		total === 0 ? "No records" : `${covered} of ${total}`;
	const humanizeStoredValue = (value: string) =>
		value
			.replaceAll("-", " ")
			.replaceAll("_", " ")
			.replace(/\b\w/gu, (character) => character.toLocaleUpperCase());
	const formatRevisionValue = (value: unknown): string => {
		if (value === null || value === undefined || value === "") {
			return "Not recorded";
		}
		if (typeof value === "string") return humanizeStoredValue(value);
		if (typeof value === "number") return String(value);
		if (typeof value === "boolean") return value ? "Yes" : "No";
		if (Array.isArray(value)) {
			if (value.length === 0) return "None";
			if (
				value.every((entry) => typeof entry === "string") &&
				value.length <= 4
			) {
				return value.map((entry) => humanizeStoredValue(entry)).join(", ");
			}
			return `${value.length} stored ${value.length === 1 ? "record" : "records"}`;
		}
		if (typeof value === "object") {
			const entries = Object.entries(value as Record<string, unknown>);
			if (entries.length === 0) return "No recorded details";
			return entries
				.slice(0, 3)
				.map(
					([key, entry]) =>
						`${humanizeStoredValue(key)}: ${formatRevisionValue(entry)}`,
				)
				.join("; ");
		}
		return "Recorded value";
	};
	const statusTone = (ready: boolean) =>
		ready ? ("success" as const) : ("warning" as const);
	const issueTone = $derived(
		passport.issues.some((issue) =>
			["critical", "blocking"].includes(issue.operationalSeverity),
		)
			? ("danger" as const)
			: ("warning" as const),
	);
	const repairActionAvailable = (issue: (typeof passport.issues)[number]) =>
		canRunRepairs &&
		issue.automatedRepairAllowed &&
		Boolean(issue.automatedRepairKey);
	const correctionActionAvailable = (issue: (typeof passport.issues)[number]) =>
		correctionWorkflowAvailable &&
		["create_catalog_correction", "review_catalog_conflict"].includes(
			issue.resolutionAction,
		);
	const actionableIssueCount = $derived(
		passport.issues.filter(repairActionAvailable).length,
	);
	const orderedIssues = $derived([
		...passport.issues.filter(repairActionAvailable),
		...passport.issues.filter((issue) => !repairActionAvailable(issue)),
	]);
	const publicationIssues = $derived(
		orderedIssues.filter(
			(issue) => issue.workCategory === "publication_blocker",
		),
	);
	const diagnosticIssues = $derived(
		orderedIssues.filter(
			(issue) => issue.workCategory === "catalog_diagnostic",
		),
	);
	const issueGroups = $derived(
		[
			{
				key: "publication",
				title: "Blocks public API publication",
				description:
					"These checks explain why this product is withheld from public blendCalcAPI v1.",
				issues: publicationIssues,
			},
			{
				key: "diagnostic",
				title: "Catalog evidence follow-up",
				description:
					"These checks improve internal revision or evidence history. They do not block the product's current API status.",
				issues: diagnosticIssues,
			},
		].filter((group) => group.issues.length > 0),
	);
</script>

<article class="catalog-product-passport">
	<header class="catalog-product-passport__identity">
		<div>
			<h2>{passport.product.productName}</h2>
			<p>
				{passport.product.brandOwner ?? "Brand not reported"} · {passport
					.product.barcode}
			</p>
		</div>
		<TextBadge
			label={getCatalogHealthStatusLabel(
				passport.product.sharedCatalogStatus
					.toLocaleLowerCase()
					.replaceAll(" ", "_"),
			)}
			tone={statusTone(passport.product.usableInBlendcalc)}
		/>
	</header>

	<section
		class="catalog-product-passport__availability"
		aria-label="Product availability"
	>
		<article>
			<span>blendCalc search</span>
			<strong
				>{passport.product.searchableInBlendcalc
					? "Available"
					: "Unavailable"}</strong
			>
		</article>
		<article>
			<span>blendCalc use</span>
			<strong
				>{passport.product.usableInBlendcalc
					? "Available"
					: "Unavailable"}</strong
			>
		</article>
		<article>
			<span>Public blendCalcAPI v1</span>
			<strong>{passport.product.blendCalcAPIV1Status}</strong>
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
			<p class="catalog-product-passport__supporting-copy">
				{passport.product.blendCalcAPIV1Status === "Ready" &&
				diagnosticIssues.length > 0 &&
				publicationIssues.length === 0
					? `This product is already public. The ${diagnosticIssues.length} ${diagnosticIssues.length === 1 ? "item below improves" : "items below improve"} internal evidence history only; none ${diagnosticIssues.length === 1 ? "is" : "are"} keeping it out of blendCalcAPI v1.`
					: !canRunRepairs
						? correctionWorkflowAvailable
							? `This screen preserves the current evidence and routes supported changes into the Correction workflow below. Opening that workflow changes nothing until a separate reviewer approves the submitted correction.`
							: `This screen explains the evidence and names the team responsible for each issue. Data operations runs any safe checks and records the final public-API outcome.`
						: actionableIssueCount === 0
							? correctionWorkflowAvailable
								? `These ${passport.issues.length} issues require an evidence-backed correction rather than a safe automatic repair. Use the Correction workflow below, or record the applicable terminal outcome if the evidence is unavailable today.`
								: `None of these ${passport.issues.length} issues can be corrected from this screen. Each card names the missing workflow. If the evidence is unavailable today, record the applicable terminal outcome below.`
							: actionableIssueCount === passport.issues.length
								? `Every current issue has a safe repair check on this screen. Run each check once, then complete the final review below if no safe change is available.`
								: `${actionableIssueCount} ${actionableIssueCount === 1 ? "issue can" : "issues can"} be checked here now. The other ${passport.issues.length - actionableIssueCount} cannot be corrected on this screen. Actionable cards are listed first.`}
			</p>
			<div class="catalog-product-passport__issue-list">
				{#each issueGroups as group (group.key)}
					<section class="catalog-product-passport__issue-group">
						<header>
							<div>
								<h3>{group.title}</h3>
								<p>{group.description}</p>
							</div>
							<TextBadge label={`${group.issues.length}`} tone="info" />
						</header>
						{#each group.issues as issue (issue.occurrenceKey)}
							<article
								class="catalog-product-passport__issue"
								id={`issue-${getCatalogHealthRepairTargetId(issue.occurrenceKey)}`}
							>
								<header>
									<strong
										>{getCatalogIssueDisplayTitle(
											issue.issueCode,
											issue.parameters,
										)}</strong
									>
									<TextBadge
										label={repairActionAvailable(issue)
											? "Check available"
											: correctionActionAvailable(issue)
												? "Continue below"
												: "No action here"}
										tone={repairActionAvailable(issue) ||
										correctionActionAvailable(issue)
											? "info"
											: "warning"}
									/>
								</header>
								<p>
									{getCatalogIssueReasonLabel(
										issue.sourceReason,
										issue.parameters,
									)}
								</p>
								<dl>
									<div>
										<dt>Impact</dt>
										<dd>{getCatalogIssueImpactLabel(issue.impact)}</dd>
									</div>
									<div>
										<dt>Owner</dt>
										<dd>
											{getCatalogResponsibleGroupLabel(issue.responsibleGroup)}
										</dd>
									</div>
									<div>
										<dt>Priority</dt>
										<dd>
											{getCatalogHealthStatusLabel(issue.operationalSeverity)}
										</dd>
									</div>
									<div>
										<dt>Detected</dt>
										<dd>{formatDate(issue.detectedAt)}</dd>
									</div>
									<div>
										<dt>Automatic repair</dt>
										<dd>
											{issue.automatedRepairAllowed
												? "Eligible after an exact-evidence safety check"
												: "More evidence required"}
										</dd>
									</div>
								</dl>
								<section class="catalog-product-passport__action">
									<span>Do this now</span>
									<strong>
										{repairActionAvailable(issue)
											? "Run the safe repair check below"
											: getCatalogResolutionActionLabel(issue.resolutionAction)}
									</strong>
									{#if repairActionAvailable(issue)}
										<p>
											The check is a preview and changes nothing. Apply appears
											only if stored evidence proves an exact repair.
										</p>
										<RoundedActionLink
											href={`#${getCatalogHealthRepairTargetId(issue.occurrenceKey)}`}
											variant="primary"
											fullWidth
											onclick={(event) =>
												focusPrivilegedWorkspaceTarget(
													event,
													getCatalogHealthRepairTargetId(issue.occurrenceKey),
												)}
										>
											Go to safe repair check
										</RoundedActionLink>
									{:else}
										<p>
											{#if correctionActionAvailable(issue)}
												<strong>Use the Correction workflow below.</strong>
												It opens the existing evidence-backed correction form and
												returns you to this review. Opening it changes nothing; only
												an approved submission creates a new product revision.
											{:else}
												<strong
													>No in-app control exists for this action yet.</strong
												>
												The {getCatalogResponsibleGroupLabel(
													issue.responsibleGroup,
												).toLocaleLowerCase()} workflow is still needed to add or
												approve the missing evidence.
											{/if}
											{canRunRepairs
												? issue.workCategory === "publication_blocker"
													? "If that evidence is unavailable today, the publication review below records that decision and removes this current item from the queue without publishing it."
													: "If that evidence is unavailable today, the evidence follow-up below records that result and removes only this diagnostic work without changing product or API data."
												: issue.workCategory === "publication_blocker"
													? "Data operations must record the final public-API outcome when that evidence is unavailable."
													: "Data operations must record the evidence follow-up outcome when no reconstruction is possible."}
										</p>
									{/if}
									<div class="catalog-product-passport__result">
										<span>Finished when</span>
										<p>
											{issue.workCategory === "publication_blocker"
												? "This issue disappears after readiness checks confirm the required evidence, or after the current evidence is deliberately accepted as not publishable by data operations."
												: "This follow-up disappears after exact history is restored, or after data operations records that the current evidence cannot reconstruct it. Neither outcome changes current API publication."}
										</p>
									</div>
								</section>
							</article>
						{/each}
					</section>
				{/each}
			</div>
		</CollapsibleSection>
	{:else if passport.reviewDisposition || passport.diagnosticReviewDisposition}
		<div class="catalog-product-passport__reviewed-message">
			<strong>Current review is complete.</strong>
			<p>
				{passport.product.blendCalcAPIV1Status === "Ready"
					? "The product remains available in blendCalc and public through blendCalcAPI v1. Only the current internal evidence follow-up was closed. Changed evidence automatically creates new work."
					: "The product remains available in blendCalc and withheld from public blendCalcAPI v1. Changed evidence automatically creates new work."}
			</p>
		</div>
	{:else}
		<p class="catalog-product-passport__ready-message">
			No current catalog-health issues were found for this product.
		</p>
	{/if}

	<CollapsibleSection title="Revision and verification" surface="panel">
		<dl class="catalog-product-passport__details">
			<div>
				<dt>Current revision</dt>
				<dd>
					{passport.revision
						? `Revision ${passport.revision.number}`
						: "Missing"}
				</dd>
			</div>
			<div>
				<dt>Label observed</dt>
				<dd>{formatDate(passport.revision?.labelObservedAt ?? null)}</dd>
			</div>
			<div>
				<dt>Revision created</dt>
				<dd>{formatDate(passport.revision?.createdAt ?? null)}</dd>
			</div>
			<div>
				<dt>Last verified</dt>
				<dd>{formatDate(passport.product.lastVerifiedAt)}</dd>
			</div>
			<div>
				<dt>Pending corrections</dt>
				<dd>{passport.product.pendingCorrectionCount}</dd>
			</div>
			<div>
				<dt>Open material conflicts</dt>
				<dd>{passport.product.openMaterialConflictCount}</dd>
			</div>
		</dl>
		{#if passport.revisionHistory.length > 0}
			<section class="catalog-product-passport__revision-history">
				<header>
					<h3>What changed in each revision</h3>
					<p>
						Each item below is a separate stored snapshot. The wording names the
						exact difference from the preceding revision.
					</p>
				</header>
				<ol>
					{#each passport.revisionHistory as revision (revision.id)}
						<li>
							<header>
								<strong>Revision {revision.number}</strong>
								<span>{formatDate(revision.createdAt)}</span>
							</header>
							<p class="catalog-product-passport__revision-source">
								Source: {humanizeStoredValue(
									revision.source,
								)}{revision.sourceReference
									? ` · ${revision.sourceReference}`
									: ""}
							</p>
							{#if revision.changes.length === 0}
								<p>Initial catalog record; there is no preceding revision.</p>
							{:else}
								<ul>
									{#each revision.changes.slice(0, 6) as change (change.fieldPath)}
										<li>
											{#if change.changeType === "added"}
												<strong>{change.fieldLabel}</strong> was added:
												{formatRevisionValue(change.newValue)}.
											{:else if change.changeType === "removed"}
												<strong>{change.fieldLabel}</strong> was removed. It was
												{formatRevisionValue(change.previousValue)}.
											{:else}
												<strong>{change.fieldLabel}</strong> changed from
												{formatRevisionValue(change.previousValue)} to
												{formatRevisionValue(change.newValue)}.
											{/if}
										</li>
									{/each}
								</ul>
								{#if revision.changes.length > 6}
									<p class="catalog-product-passport__revision-more">
										And {revision.changes.length - 6} more stored
										{revision.changes.length - 6 === 1 ? "change" : "changes"}.
									</p>
								{/if}
							{/if}
						</li>
					{/each}
				</ol>
			</section>
		{/if}
	</CollapsibleSection>

	<CollapsibleSection title="Evidence coverage" surface="panel">
		<dl class="catalog-product-passport__details">
			<div>
				<dt>Selected product fields</dt>
				<dd>{passport.evidence.selectedFieldCount}</dd>
			</div>
			<div>
				<dt>Existing nutrient records with source evidence</dt>
				<dd>
					{formatEvidenceCoverage(
						passport.evidence.nutrientsWithSourceEvidenceCount,
						passport.evidence.normalizedNutrientCount,
					)}
				</dd>
			</div>
			<div>
				<dt>Servings with source evidence</dt>
				<dd>
					{formatEvidenceCoverage(
						passport.evidence.servingsWithSourceEvidenceCount,
						passport.evidence.servingCount,
					)}
				</dd>
			</div>
			<div>
				<dt>Stored observations</dt>
				<dd>{passport.evidence.observationCount}</dd>
			</div>
		</dl>
		{#if passport.evidence.sources.length > 0}
			<p class="catalog-product-passport__sources">
				<strong>Evidence sources:</strong>
				{passport.evidence.sources.join(", ")}
			</p>
		{/if}
	</CollapsibleSection>

	<CollapsibleSection title="blendCalcAPI publication checks" surface="panel">
		<p class="catalog-product-passport__supporting-copy">
			The API status is evaluated separately from whether this product remains
			useful inside blendCalc.
		</p>
		<dl class="catalog-product-passport__details">
			<div>
				<dt>blendCalcAPI v1 status</dt>
				<dd>{passport.product.blendCalcAPIV1Status}</dd>
			</div>
			<div>
				<dt>Catalog status</dt>
				<dd>{passport.product.sharedCatalogStatus}</dd>
			</div>
			<div>
				<dt>Quality checks recorded</dt>
				<dd>{Object.keys(passport.qualityDimensions).length}</dd>
			</div>
		</dl>
	</CollapsibleSection>
</article>

<style lang="scss">
	@use "./CatalogProductReadinessPassport.scss";
</style>
