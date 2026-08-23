<script lang="ts">
	import ModerationWorkspace from "$lib/components/moderation/ModerationWorkspace/ModerationWorkspace.svelte";
	import PrivilegedToolRightSheet from "$lib/components/moderation/PrivilegedToolRightSheet/PrivilegedToolRightSheet.svelte";
	import type { PrivilegedToolWorkspaceViewProps } from "./types";

	let {
		id,
		title,
		subtitle,
		informationKey,
		data,
		form = null,
		scope,
		onClose,
	}: PrivilegedToolWorkspaceViewProps = $props();
</script>

<PrivilegedToolRightSheet {id} {title} {subtitle} {informationKey} {onClose}>
	<ModerationWorkspace {data} {form} {scope} />
</PrivilegedToolRightSheet>
