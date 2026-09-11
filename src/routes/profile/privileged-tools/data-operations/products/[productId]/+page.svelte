<script lang="ts">
	import { goto } from "$app/navigation";
	import CatalogProductRepairControls from "$lib/components/moderation/CatalogProductRepairControls/CatalogProductRepairControls.svelte";
	import CatalogProductReadinessPassport from "$lib/components/moderation/CatalogProductReadinessPassport/CatalogProductReadinessPassport.svelte";
	import CatalogProductReviewDisposition from "$lib/components/moderation/CatalogProductReviewDisposition/CatalogProductReviewDisposition.svelte";
	import CatalogCorrectionHandoff from "$lib/components/moderation/CatalogCorrectionHandoff/CatalogCorrectionHandoff.svelte";
	import PrivilegedToolWorkspaceView from "$lib/components/moderation/PrivilegedToolWorkspaceView/PrivilegedToolWorkspaceView.svelte";
	import ProfilePage from "../../../../+page.svelte";
	import type { CatalogOperationsProductPageProps } from "./types";

	let { data, form }: CatalogOperationsProductPageProps = $props();
	const actionableIssueCount = $derived(
		data.canRunRepairs
			? data.passport.issues.filter(
					(issue) =>
						issue.automatedRepairAllowed && Boolean(issue.automatedRepairKey),
				).length
			: 0,
	);
	const reviewFinished = $derived(Boolean(data.passport.reviewDisposition));
	const closeAction = () => {
		void goto("/profile/privileged-tools/data-operations", {
			replaceState: true,
		});
	};
</script>

<ProfilePage />
<PrivilegedToolWorkspaceView
	id="profile-data-operations-product-view"
	title="Product readiness"
	subtitle="Inspect this product's catalog availability, API checks, evidence, and repair ownership."
	informationKey="data-operations"
	guide={{
		tone:
			data.passport.issues.length > 0 && !reviewFinished
				? "attention"
				: "clear",
		title: reviewFinished
			? "Review finished — product remains withheld"
			: data.passport.issues.length > 0
				? actionableIssueCount > 0
					? `Run ${actionableIssueCount} safe repair ${actionableIssueCount === 1 ? "check" : "checks"}`
					: "Finish this product review"
				: "This product has no open readiness issues",
		description: reviewFinished
			? "The current evidence was reviewed and accepted as not publishable. It is no longer actionable work, but any changed evidence will reopen it automatically."
			: data.passport.issues.length > 0
				? data.canRunRepairs
					? `${data.passport.issues.length} current ${data.passport.issues.length === 1 ? "issue is" : "issues are"} keeping this product out of the public API. Run each available safe check once. If no exact repair is possible, record why and finish the review at the bottom of this page.`
					: "Start with What needs attention. This role can inspect ownership and next steps but cannot run repairs from this screen."
				: "The current catalog and publication checks found no operational work for this product.",
		completion: reviewFinished
			? "No action is required unless the product or its evidence changes."
			: "Every safe check is complete and the product is either publishable or has a recorded accepted-withheld outcome.",
		count: reviewFinished ? 0 : actionableIssueCount,
		countLabel: reviewFinished
			? "current actions"
			: "safe repair checks available on this screen",
	}}
	feedbackMessage={form?.catalogReviewDispositionSuccess ??
		form?.catalogRepairSuccess}
	feedbackTone="success"
	onClose={closeAction}
>
	<CatalogProductReadinessPassport
		passport={data.passport}
		canRunRepairs={data.canRunRepairs}
		correctionWorkflowAvailable={data.correctionHandoff.findings.length > 0}
	/>
	<CatalogCorrectionHandoff
		handoff={data.correctionHandoff}
		returnPath={`/profile/privileged-tools/data-operations/products/${data.passport.product.id}`}
	/>
	{#if data.canRunRepairs}
		<CatalogProductRepairControls issues={data.passport.issues} {form} />
		<CatalogProductReviewDisposition
			passport={data.passport}
			canFinishReview={data.canRunRepairs}
			{form}
		/>
	{/if}
</PrivilegedToolWorkspaceView>
