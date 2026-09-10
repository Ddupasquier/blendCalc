<script lang="ts">
	import { goto } from "$app/navigation";
	import CatalogProductReadinessPassport from "$lib/components/moderation/CatalogProductReadinessPassport/CatalogProductReadinessPassport.svelte";
	import PrivilegedToolWorkspaceView from "$lib/components/moderation/PrivilegedToolWorkspaceView/PrivilegedToolWorkspaceView.svelte";
	import ProfilePage from "../../../../+page.svelte";
	import type { CatalogReviewProductPageProps } from "./types";

	let { data }: CatalogReviewProductPageProps = $props();
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
				? "Review the evidence, then hand off to Data operations"
				: "No review concern is open for this product",
		description:
			data.passport.issues.length > 0
				? `${data.passport.issues.length} ${data.passport.issues.length === 1 ? "issue is" : "issues are"} open. This screen is evidence-only: identify what is missing, then ask a Data operations reviewer to run the safe checks and record whether the product should stay out of the public API.`
				: "The current evidence does not identify a catalog-review decision for this product.",
		completion:
			"You have identified the missing evidence and handed the product to Data operations. That reviewer either repairs it or finishes the review with the product still withheld from the public API.",
		countLabel: "actions available on this evidence-only screen",
	}}
	onClose={closeAction}
>
	<CatalogProductReadinessPassport passport={data.passport} />
</PrivilegedToolWorkspaceView>
