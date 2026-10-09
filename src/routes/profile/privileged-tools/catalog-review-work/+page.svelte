<script lang="ts">
	import { goto } from "$app/navigation";
	import CatalogReviewProductInbox from "$lib/components/moderation/CatalogReviewProductInbox/CatalogReviewProductInbox.svelte";
	import PrivilegedToolWorkspaceView from "$lib/components/moderation/PrivilegedToolWorkspaceView/PrivilegedToolWorkspaceView.svelte";
	import { untrack } from "svelte";
	import ProfilePage from "../../+page.svelte";
	import type { CatalogReviewWorkPageProps } from "./types";

	let { data, form }: CatalogReviewWorkPageProps = $props();
	let scrollContainer = $state<HTMLElement | null>(null);
	let currentPage = $state(untrack(() => data.productsPage));
	const closeAction = () => {
		void goto("/profile/privileged-tools", { replaceState: true });
	};
	const actionCount = $derived(
		currentPage.counts.safetyMatches +
			currentPage.counts.conflicts +
			currentPage.counts.providerChanges,
	);
	const productCount = $derived(currentPage.total);
</script>

<ProfilePage />
<PrivilegedToolWorkspaceView
	bind:scrollContainer
	id="profile-catalog-review-work-view"
	title="Catalog review work"
	subtitle="Resolve evidence-backed product changes, conflicts, and possible recall matches."
	informationKey="catalog-review-work"
	guide={{
		tone: actionCount > 0 ? "attention" : "clear",
		title:
			productCount > 0
				? `Review ${productCount} ${productCount === 1 ? "product" : "products"}`
				: "No catalog decisions need review",
		description:
			productCount > 0
				? `${actionCount} individual ${actionCount === 1 ? "decision is" : "decisions are"} grouped by product. Open one product to work through all of its possible recalls, conflicts, and provider changes.`
				: "There are no possible recall matches, product conflicts, or provider changes waiting for a decision.",
		completion:
			"Every item has a recorded evidence-based decision, and supported changes are routed into a separate catalog correction.",
		count: productCount,
		countLabel: "products requiring review",
	}}
	feedbackMessage={form?.catalogReviewError ?? form?.catalogReviewSuccess}
	feedbackTone={form?.catalogReviewError ? "danger" : "success"}
	onClose={closeAction}
>
	<CatalogReviewProductInbox
		page={data.productsPage}
		{scrollContainer}
		onPageChange={(page) => {
			currentPage = page;
		}}
	/>
</PrivilegedToolWorkspaceView>
