<script lang="ts">
	import ModerationWorkspace from "$lib/components/moderation/ModerationWorkspace/ModerationWorkspace.svelte";
	import { formatDocumentTitle } from "$lib/config/pageMetadata";
	import type { ModerationPageProps } from "./types";

	let { data, form }: ModerationPageProps = $props();
</script>

<svelte:head>
	<title>{formatDocumentTitle("Moderation")}</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<ModerationWorkspace {data} {form} />
