<script lang="ts">
	import ModerationWorkspace from "$lib/components/moderation/ModerationWorkspace/ModerationWorkspace.svelte";
	import ModeratorActionRightSheet from "$lib/components/moderation/ModeratorActionRightSheet/ModeratorActionRightSheet.svelte";
	import type { ModeratorActionWorkspaceViewProps } from "./types";

	let {
		id,
		title,
		subtitle,
		data,
		form = null,
		scope,
		onClose,
	}: ModeratorActionWorkspaceViewProps = $props();
</script>

<ModeratorActionRightSheet {id} {title} {subtitle} {onClose}>
	<ModerationWorkspace {data} {form} {scope} />
</ModeratorActionRightSheet>
