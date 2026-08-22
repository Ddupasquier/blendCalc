<script lang="ts">
	import { goto } from "$app/navigation";
	import DataHealthDashboard from "$lib/components/moderation/DataHealthDashboard/DataHealthDashboard.svelte";
	import ModeratorActionRightSheet from "$lib/components/moderation/ModeratorActionRightSheet/ModeratorActionRightSheet.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import ProfilePage from "../../+page.svelte";
	import type { CatalogDataHealthPageProps } from "./types";

	let { data, form }: CatalogDataHealthPageProps = $props();

	const closeAction = () => {
		void goto("/profile/moderator-actions", { replaceState: true });
	};
</script>

<ProfilePage />
<ModeratorActionRightSheet
	id="profile-catalog-data-health-view"
	title="Catalog data health"
	subtitle="Review recalls, provider changes, mapping gaps, and catalog readiness without exposing private evidence."
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
</ModeratorActionRightSheet>
