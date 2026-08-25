<script lang="ts">
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import PrivilegedToolRightSheet from "$lib/components/moderation/PrivilegedToolRightSheet/PrivilegedToolRightSheet.svelte";
	import type { PrivilegedToolWorkspaceViewProps } from "./types";

	let {
		id,
		title,
		subtitle,
		informationKey,
		feedbackMessage,
		feedbackTone = "info",
		onClose,
		children,
	}: PrivilegedToolWorkspaceViewProps = $props();
</script>

<PrivilegedToolRightSheet {id} {title} {subtitle} {informationKey} {onClose}>
	{#if feedbackMessage}
		<StatusMessage tone={feedbackTone} message={feedbackMessage} />
	{/if}
	{@render children()}
</PrivilegedToolRightSheet>
