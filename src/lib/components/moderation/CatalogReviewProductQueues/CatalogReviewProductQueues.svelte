<script lang="ts">
	import { untrack, tick } from "svelte";
	import { createProgressiveListController } from "$lib/utils/navigation/progressiveListController.svelte";
	import {
		fetchCatalogReviewPage,
		type CatalogReviewPage,
		type CatalogReviewPageRows,
	} from "$lib/utils/moderation/catalogReviewPagination";
	import ProgressiveListFooter from "$lib/components/common/navigation/ProgressiveListFooter/ProgressiveListFooter.svelte";
	import CatalogReviewWorkDashboard from "$lib/components/moderation/CatalogReviewWorkDashboard/CatalogReviewWorkDashboard.svelte";
	import CatalogConflictDecisionWorkbench from "$lib/components/moderation/CatalogConflictDecisionWorkbench/CatalogConflictDecisionWorkbench.svelte";
	import CatalogCorrectionHandoff from "$lib/components/moderation/CatalogCorrectionHandoff/CatalogCorrectionHandoff.svelte";
	import type { CatalogCorrectionFinding } from "$lib/server/moderation/catalogCorrectionHandoff.server";
	import type { CatalogReviewProductQueuesProps } from "./types";

	let {
		productId,
		pages,
		handoff,
		scrollContainer,
		correctionAvailable = false,
		onOpenCorrection,
		onCountsChange = () => {},
	}: CatalogReviewProductQueuesProps = $props();
	const safety = createProgressiveListController<
		CatalogReviewPageRows["safetyMatches"],
		CatalogReviewPage<"safetyMatches">
	>(
		untrack(() => pages.safetyMatches),
		(cursor, signal) =>
			fetchCatalogReviewPage("safetyMatches", productId, cursor, signal),
	);
	const conflicts = createProgressiveListController<
		CatalogReviewPageRows["conflicts"],
		CatalogReviewPage<"conflicts">
	>(
		untrack(() => pages.conflicts),
		(cursor, signal) =>
			fetchCatalogReviewPage("conflicts", productId, cursor, signal),
	);
	const providers = createProgressiveListController<
		CatalogReviewPageRows["providerChanges"],
		CatalogReviewPage<"providerChanges">
	>(
		untrack(() => pages.providerChanges),
		(cursor, signal) =>
			fetchCatalogReviewPage("providerChanges", productId, cursor, signal),
	);
	const counts = $derived({
		conflicts: conflicts.state.total,
		safetyMatches: safety.state.total,
		providerChanges: providers.state.total,
	});
	const work = $derived({
		conflicts: [],
		safetyMatches: safety.state.items,
		providerChanges: providers.state.items,
		counts,
		issueLimit: 20,
	});
	const correctionFindings: CatalogCorrectionFinding[] = $derived([
		...handoff.findings.filter(
			(finding) =>
				finding.type !== "catalog_conflict" &&
				finding.type !== "provider_change",
		),
		...providers.state.items.map((review): CatalogCorrectionFinding => ({
			id: review.id,
			type: "provider_change",
			label: "Provider change awaiting a decision",
			fieldLabel: "Provider change",
			comparisonBasis: null,
			affectedFieldPaths: review.materialFieldPaths,
			evidence: [],
			currentValue: null,
			status:
				review.correctionStatus === "linked"
					? "correction_submitted"
					: "needs_correction",
			submissionId: review.submissionId,
		})),
	]);
	let previousPages = untrack(() => pages);
	const preserveScroll = async (action: () => Promise<void>) => {
		const root = scrollContainer,
			position = root?.scrollTop;
		await action();
		await tick();
		if (root && position !== undefined) root.scrollTop = position;
	};
	$effect(() => {
		const current = pages;
		if (current === previousPages) return;
		previousPages = current;
		void untrack(() =>
			preserveScroll(async () => {
				await Promise.all([
					safety.refresh(current.safetyMatches),
					conflicts.refresh(current.conflicts),
					providers.refresh(current.providerChanges),
				]);
			}),
		);
	});
	$effect(() => {
		onCountsChange(counts);
	});
	$effect(() => () => {
		safety.destroy();
		conflicts.destroy();
		providers.destroy();
	});
</script>

<CatalogReviewWorkDashboard
	reviewWork={work}
	hideConflicts
	hideHeading
	visibleQueue="safetyMatches"
	refreshing={safety.state.refreshing || safety.needsRefresh}
>
	{#snippet safetyControls()}
		<ProgressiveListFooter
			label="Recall matches"
			loadedCount={safety.state.items.length}
			total={safety.state.total}
			hasMore={safety.state.nextCursor !== null}
			loading={safety.state.loading || safety.state.refreshing}
			error={safety.state.error}
			{scrollContainer}
			onLoadMore={() => preserveScroll(safety.loadMore)}
			onRetry={() =>
				preserveScroll(safety.needsRefresh ? safety.refresh : safety.loadMore)}
		/>
	{/snippet}
</CatalogReviewWorkDashboard>

<CatalogConflictDecisionWorkbench
	{productId}
	handoff={{ ...handoff, findings: conflicts.state.items }}
	totalCount={conflicts.state.total}
	evidenceRevision={conflicts.state.page.revision}
	refreshing={conflicts.state.refreshing || conflicts.needsRefresh}
>
	{#snippet paginationControls()}
		<ProgressiveListFooter
			label="Conflicts"
			loadedCount={conflicts.state.items.length}
			total={conflicts.state.total}
			hasMore={conflicts.state.nextCursor !== null}
			loading={conflicts.state.loading || conflicts.state.refreshing}
			error={conflicts.state.error}
			{scrollContainer}
			onLoadMore={() => preserveScroll(conflicts.loadMore)}
			onRetry={() =>
				preserveScroll(
					conflicts.needsRefresh ? conflicts.refresh : conflicts.loadMore,
				)}
		/>
	{/snippet}
</CatalogConflictDecisionWorkbench>
<CatalogReviewWorkDashboard
	reviewWork={work}
	hideConflicts
	hideHeading
	visibleQueue="providerChanges"
	refreshing={providers.state.refreshing || providers.needsRefresh}
>
	{#snippet providerControls()}
		<ProgressiveListFooter
			label="Provider changes"
			loadedCount={providers.state.items.length}
			total={providers.state.total}
			hasMore={providers.state.nextCursor !== null}
			loading={providers.state.loading || providers.state.refreshing}
			error={providers.state.error}
			{scrollContainer}
			onLoadMore={() => preserveScroll(providers.loadMore)}
			onRetry={() =>
				preserveScroll(
					providers.needsRefresh ? providers.refresh : providers.loadMore,
				)}
		/>
	{/snippet}
</CatalogReviewWorkDashboard>

<CatalogCorrectionHandoff
	handoff={{
		...handoff,
		applicationFoodId: correctionAvailable ? handoff.applicationFoodId : null,
		findings: correctionFindings,
	}}
	returnPath={`/profile/privileged-tools/catalog-review-work/products/${productId}`}
	{onOpenCorrection}
/>
