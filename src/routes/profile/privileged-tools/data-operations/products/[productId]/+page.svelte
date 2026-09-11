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
	const safeRepairCheckCount = $derived(
		data.canRunRepairs
			? data.passport.issues.filter(
					(issue) =>
						issue.automatedRepairAllowed && Boolean(issue.automatedRepairKey),
				).length
			: 0,
	);
	const publicationIssues = $derived(
		data.passport.issues.filter(
			(issue) => issue.workCategory === "publication_blocker",
		),
	);
	const diagnosticIssues = $derived(
		data.passport.issues.filter(
			(issue) => issue.workCategory === "catalog_diagnostic",
		),
	);
	const hasOnlyDiagnostics = $derived(
		publicationIssues.length === 0 && diagnosticIssues.length > 0,
	);
	const allCurrentWorkFinished = $derived(
		data.passport.issues.length === 0 &&
			Boolean(
				data.passport.reviewDisposition ||
				data.passport.diagnosticReviewDisposition,
			),
	);
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
			data.passport.issues.length > 0 && !allCurrentWorkFinished
				? "attention"
				: "clear",
		title: allCurrentWorkFinished
			? data.passport.product.blendCalcAPIV1Status === "Ready"
				? "Evidence follow-up finished — product remains public"
				: "Review finished — product remains withheld"
			: hasOnlyDiagnostics
				? `Review ${diagnosticIssues.length} catalog-evidence ${diagnosticIssues.length === 1 ? "follow-up" : "follow-ups"}`
				: data.passport.issues.length > 0
					? `Resolve ${publicationIssues.length} public-API ${publicationIssues.length === 1 ? "blocker" : "blockers"}`
					: "This product has no open readiness issues",
		description: allCurrentWorkFinished
			? data.passport.product.blendCalcAPIV1Status === "Ready"
				? "The current evidence gaps were reviewed without changing product data or public API availability. Changed evidence will reopen the follow-up automatically."
				: "The current evidence was reviewed and accepted as not publishable. It is no longer actionable work, but any changed evidence will reopen it automatically."
			: data.passport.issues.length > 0
				? hasOnlyDiagnostics
					? `This product is already ${data.passport.product.blendCalcAPIV1Status.toLocaleLowerCase()} for blendCalcAPI v1. Run each history check once. If exact evidence cannot be reconstructed, finish the evidence follow-up without changing product or API data.`
					: data.canRunRepairs
						? `${publicationIssues.length} current ${publicationIssues.length === 1 ? "issue is" : "issues are"} keeping this product out of the public API. ${diagnosticIssues.length > 0 ? `${diagnosticIssues.length} separate evidence ${diagnosticIssues.length === 1 ? "follow-up does" : "follow-ups do"} not affect publication. ` : ""}Run each available safe check once. If no exact repair is possible, record why and finish the matching review below.`
						: "Start with What needs attention. This role can inspect ownership and next steps but cannot run repairs from this screen."
				: "The current catalog and publication checks found no operational work for this product.",
		completion: allCurrentWorkFinished
			? "No action is required unless the product or its evidence changes."
			: hasOnlyDiagnostics
				? "Every evidence follow-up is repaired or recorded as currently unreconstructable. Public API availability remains unchanged."
				: "Every publication blocker is resolved or recorded as accepted-withheld, and every separate evidence follow-up has its own outcome.",
		count: allCurrentWorkFinished ? 0 : data.passport.issues.length,
		countLabel: allCurrentWorkFinished
			? "current actions"
			: `${safeRepairCheckCount} safe ${safeRepairCheckCount === 1 ? "check" : "checks"} available within the current work`,
	}}
	feedbackMessage={form?.catalogRepairSuccess}
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
			category="publication"
			canFinishReview={data.canRunRepairs}
			{form}
		/>
		<CatalogProductReviewDisposition
			passport={data.passport}
			category="diagnostic"
			canFinishReview={data.canRunRepairs}
			{form}
		/>
	{/if}
</PrivilegedToolWorkspaceView>
