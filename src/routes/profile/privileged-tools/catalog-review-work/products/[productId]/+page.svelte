<script lang="ts">
	import { goto } from "$app/navigation";
	import ManualEntrySheet from "$lib/components/ingredients/sheets/ManualEntrySheet/ManualEntrySheet.svelte";
	import CatalogConflictDecisionWorkbench from "$lib/components/moderation/CatalogConflictDecisionWorkbench/CatalogConflictDecisionWorkbench.svelte";
	import CatalogCorrectionHandoff from "$lib/components/moderation/CatalogCorrectionHandoff/CatalogCorrectionHandoff.svelte";
	import CatalogReviewProductRail from "$lib/components/moderation/CatalogReviewProductRail/CatalogReviewProductRail.svelte";
	import CatalogReviewWorkDashboard from "$lib/components/moderation/CatalogReviewWorkDashboard/CatalogReviewWorkDashboard.svelte";
	import PrivilegedToolWorkspaceView from "$lib/components/moderation/PrivilegedToolWorkspaceView/PrivilegedToolWorkspaceView.svelte";
	import ProfilePage from "../../../../+page.svelte";
	import type { ProductEvidenceRole } from "$lib/utils/products/productEvidenceRequirements";
	import type { CatalogReviewProductPageProps } from "./types";

	let { data, form }: CatalogReviewProductPageProps = $props();
	let correctionOpen = $state(false);
	let correctionEvidenceRoles = $state<ProductEvidenceRole[] | undefined>();
	const closeAction = () => {
		void goto("/profile/privileged-tools/catalog-review-work", {
			replaceState: true,
		});
	};
	const directDecisionCount = $derived(
		data.reviewWork.counts.safetyMatches +
			data.reviewWork.counts.providerChanges,
	);
	const conflictCount = $derived(
		data.correctionHandoff.findings.filter(
			(finding) =>
				finding.type === "catalog_conflict" &&
				finding.status === "needs_correction",
		).length,
	);
	const diagnosticCount = $derived(
		data.passport.issues.filter(
			(issue) => issue.workCategory === "catalog_diagnostic",
		).length,
	);
	const decisionWorkbenchAvailable = $derived(
		data.correctionHandoff.decisionWorkbenchAvailable !== false,
	);
	const openCorrection = (evidenceRoles: ProductEvidenceRole[]) => {
		correctionEvidenceRoles = evidenceRoles;
		correctionOpen = true;
	};
	const closeCorrection = () => {
		correctionOpen = false;
	};
</script>

{#snippet productSidebar()}
	<CatalogReviewProductRail
		passport={data.passport}
		{conflictCount}
		{diagnosticCount}
		pendingSubmissionId={data.correctionHandoff.pendingSubmissionId}
	/>
{/snippet}

<ProfilePage />
<PrivilegedToolWorkspaceView
	id="profile-catalog-review-product-view"
	title="Product readiness"
	subtitle="Review this product's current evidence, conflicts, and correction needs."
	informationKey="catalog-review-work"
	guide={{
		tone:
			conflictCount > 0 ||
			directDecisionCount > 0 ||
			data.correctionHandoff.pendingSubmissionId
				? "attention"
				: "clear",
		title:
			conflictCount > 0
				? decisionWorkbenchAvailable
					? `Finish ${conflictCount} field ${conflictCount === 1 ? "decision" : "decisions"}`
					: `Review ${conflictCount} conflicting ${conflictCount === 1 ? "field" : "fields"}`
				: directDecisionCount > 0
					? "Finish the remaining review action"
					: data.correctionHandoff.pendingSubmissionId
						? "Finish the pending correction review"
						: "No review concern is open for this product",
		description:
			conflictCount > 0
				? decisionWorkbenchAvailable
					? "Compare the stored value with the provider evidence, choose one outcome for every field, explain each decision, then finish once."
					: "Compare the stored value with every provider observation below, then open one prefilled correction containing the supported changes. Nothing changes until that correction is reviewed."
				: directDecisionCount > 0
					? "Complete the action below. Its card explains exactly what approval and rejection will do."
					: data.correctionHandoff.pendingSubmissionId
						? "This product has left the conflict queue. Open its linked submission below; approval applies the reviewed correction, while rejection returns unresolved conflicts here."
						: "The current evidence does not identify a catalog-review decision for this product.",
		completion: decisionWorkbenchAvailable
			? "Every field has one recorded outcome. Any replacement becomes one pending correction; keeping a value closes that conflict; insufficient evidence removes only the unchanged evidence snapshot from this queue."
			: "One correction submission is created for the supported changes. Approval applies it; rejection leaves the catalog unchanged and returns unresolved conflicts for another review.",
		countLabel: "field decisions",
	}}
	sidebar={productSidebar}
	feedbackMessage={form?.catalogReviewError ?? form?.catalogReviewSuccess}
	feedbackTone={form?.catalogReviewError ? "danger" : "success"}
	onClose={closeAction}
>
	{#if directDecisionCount > 0}
		<CatalogReviewWorkDashboard
			reviewWork={data.reviewWork}
			hideConflicts
			hideHeading
		/>
	{/if}
	{#if conflictCount > 0 && decisionWorkbenchAvailable}
		<CatalogConflictDecisionWorkbench
			productId={data.passport.product.id}
			handoff={data.correctionHandoff}
		/>
	{:else if data.correctionHandoff.findings.length > 0}
		<CatalogCorrectionHandoff
			handoff={{
				...data.correctionHandoff,
				applicationFoodId: data.correctionFood
					? data.correctionHandoff.applicationFoodId
					: null,
				findings: decisionWorkbenchAvailable
					? data.correctionHandoff.findings.filter(
							(finding) => finding.type !== "catalog_conflict",
						)
					: data.correctionHandoff.findings,
			}}
			returnPath={`/profile/privileged-tools/catalog-review-work/products/${data.passport.product.id}`}
			onOpenCorrection={openCorrection}
		/>
	{/if}
</PrivilegedToolWorkspaceView>

<ManualEntrySheet
	open={correctionOpen && Boolean(data.correctionFood)}
	initialFood={data.correctionFood ?? undefined}
	submissionIntent="catalog_correction"
	catalogSubmissionOnly
	catalogCorrectionEvidenceRoles={correctionEvidenceRoles}
	allowBarcodeAutofill={false}
	onClose={closeCorrection}
	onCreate={() => {}}
/>
