<script lang="ts">
	import DataHealthDashboard from "$lib/components/moderation/DataHealthDashboard/DataHealthDashboard.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import { formatDocumentTitle } from "$lib/config/pageMetadata";
	import type { ModeratorDataHealthPageProps } from "./types";

	let { data, form }: ModeratorDataHealthPageProps = $props();
</script>

<svelte:head>
	<title>{formatDocumentTitle("Catalog Data Health")}</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="moderator-data-health-page">
	<a class="moderator-data-health-page__back" href="/moderation">Back to moderation</a>
	{#if form?.monitorReviewError}
		<StatusMessage tone="danger" message={form.monitorReviewError} />
	{:else if form?.monitorReviewSuccess}
		<StatusMessage tone="success" message={form.monitorReviewSuccess} />
	{/if}
	<DataHealthDashboard
		dashboard={data.dashboard}
		catalogMonitor={data.catalogMonitor}
		viewerRole={data.viewerRole}
	/>
</div>

<style lang="scss">
	@use "./page.scss";
</style>
