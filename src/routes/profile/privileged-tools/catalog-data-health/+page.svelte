<script lang="ts">
	import { goto } from "$app/navigation";
	import DataHealthDashboard from "$lib/components/moderation/DataHealthDashboard/DataHealthDashboard.svelte";
	import PrivilegedToolRightSheet from "$lib/components/moderation/PrivilegedToolRightSheet/PrivilegedToolRightSheet.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import ProfilePage from "../../+page.svelte";
	import type { CatalogDataHealthPageProps } from "./types";

	let { data, form }: CatalogDataHealthPageProps = $props();

	const closeAction = () => {
		void goto("/profile/privileged-tools", { replaceState: true });
	};
</script>

<ProfilePage />
<PrivilegedToolRightSheet
	id="profile-catalog-data-health-view"
	title="Catalog data health"
	subtitle="Review recalls, provider changes, mapping gaps, and catalog readiness without exposing private evidence."
	informationKey="catalog-data-health"
	onClose={closeAction}
>
	{#if form?.monitorReviewError}
		<StatusMessage tone="danger" message={form.monitorReviewError} />
	{:else if form?.monitorReviewSuccess}
		<StatusMessage tone="success" message={form.monitorReviewSuccess} />
	{/if}
	<DataHealthDashboard
		dashboard={data.dashboard}
		catalogMonitor={data.catalogMonitor}
		viewerRole={data.viewerRole}
		showHeader={false}
	/>
</PrivilegedToolRightSheet>
