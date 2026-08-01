<script lang="ts">
	import DataHealthDashboard from "$lib/components/moderation/DataHealthDashboard/DataHealthDashboard.svelte";
	import { formatDocumentTitle } from "$lib/config/pageMetadata";
	import type { ModeratorDataHealthPageProps } from "./types";

	let { data }: ModeratorDataHealthPageProps = $props();
</script>

<svelte:head>
	<title>{formatDocumentTitle("Catalog Data Health")}</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="moderator-data-health-page">
	<a class="moderator-data-health-page__back" href="/moderation">Back to moderation</a>
	<DataHealthDashboard dashboard={data.dashboard} viewerRole={data.viewerRole} />
</div>

<style lang="scss">
	@use "./page.scss";
</style>
