<script lang="ts">
	import { goto } from "$app/navigation";
	import CatalogProductReadinessPassport from "$lib/components/moderation/CatalogProductReadinessPassport/CatalogProductReadinessPassport.svelte";
	import CatalogCorrectionHandoff from "$lib/components/moderation/CatalogCorrectionHandoff/CatalogCorrectionHandoff.svelte";
	import PrivilegedToolWorkspaceView from "$lib/components/moderation/PrivilegedToolWorkspaceView/PrivilegedToolWorkspaceView.svelte";
	import ProfilePage from "../../../../+page.svelte";
	import type { CatalogReviewProductPageProps } from "./types";

	let { data, form }: CatalogReviewProductPageProps = $props();
	const closeAction = () => {
		void goto("/profile/privileged-tools/catalog-review-work", {
			replaceState: true,
		});
	};
</script>

<ProfilePage />
<PrivilegedToolWorkspaceView
	id="profile-catalog-review-product-view"
	title="Product readiness"
	subtitle="Review this product's current evidence, conflicts, and correction needs."
	informationKey="catalog-review-work"
	guide={{
		tone: data.passport.issues.length > 0 ? "attention" : "clear",
		title:
			data.passport.issues.length > 0
				? "Decide each catalog finding from the evidence"
				: "No review concern is open for this product",
		description:
			data.correctionHandoff.findings.length > 0
				? `${data.correctionHandoff.findings.length} correction ${data.correctionHandoff.findings.length === 1 ? "finding is" : "findings are"} open. Review the evidence below, then use the Correction workflow card to open the prefilled form or continue an already-linked submission.`
				: data.passport.issues.length > 0
					? `${data.passport.issues.length} evidence ${data.passport.issues.length === 1 ? "issue is" : "issues are"} open. No supported catalog-correction finding is attached; use the named owner and next step on each issue.`
					: "The current evidence does not identify a catalog-review decision for this product.",
		completion:
			"Every correction finding is linked to one pending submission, resolved by an approved revision, or closed with an evidence-backed decision to keep the current value.",
		countLabel: "actions available on this evidence-only screen",
	}}
	feedbackMessage={form?.catalogReviewError ?? form?.catalogReviewSuccess}
	feedbackTone={form?.catalogReviewError ? "danger" : "success"}
	onClose={closeAction}
>
	<CatalogProductReadinessPassport
		passport={data.passport}
		correctionWorkflowAvailable={data.correctionHandoff.findings.length > 0}
	/>
	<CatalogCorrectionHandoff
		handoff={data.correctionHandoff}
		returnPath={`/profile/privileged-tools/catalog-review-work/products/${data.passport.product.id}`}
		allowConflictResolution
	/>
</PrivilegedToolWorkspaceView>
