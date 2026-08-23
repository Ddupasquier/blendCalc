<script lang="ts">
	import { goto } from "$app/navigation";
	import CatalogReviewWorkDashboard from "$lib/components/moderation/CatalogReviewWorkDashboard/CatalogReviewWorkDashboard.svelte";
	import PrivilegedToolRightSheet from "$lib/components/moderation/PrivilegedToolRightSheet/PrivilegedToolRightSheet.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import ProfilePage from "../../+page.svelte";
	import type { CatalogReviewWorkPageProps } from "./types";

	let { data, form }: CatalogReviewWorkPageProps = $props();
	const closeAction = () => {
		void goto("/profile/privileged-tools", { replaceState: true });
	};
</script>

<ProfilePage />
<PrivilegedToolRightSheet
	id="profile-catalog-review-work-view"
	title="Catalog review work"
	subtitle="Resolve evidence-backed product changes, conflicts, and possible recall matches."
	informationKey="catalog-review-work"
	onClose={closeAction}
>
	{#if form?.catalogReviewError}
		<StatusMessage tone="danger" message={form.catalogReviewError} />
	{:else if form?.catalogReviewSuccess}
		<StatusMessage tone="success" message={form.catalogReviewSuccess} />
	{/if}
	<CatalogReviewWorkDashboard reviewWork={data.reviewWork} />
</PrivilegedToolRightSheet>
