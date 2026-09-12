<script lang="ts">
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import PrivilegedProductLookup from "$lib/components/moderation/PrivilegedProductLookup/PrivilegedProductLookup.svelte";
	import PrivilegedToolRightSheet from "$lib/components/moderation/PrivilegedToolRightSheet/PrivilegedToolRightSheet.svelte";
	import PrivilegedWorkspaceGuide from "$lib/components/moderation/PrivilegedWorkspaceGuide/PrivilegedWorkspaceGuide.svelte";
	import type { PrivilegedToolWorkspaceViewProps } from "./types";

	let {
		id,
		title,
		subtitle,
		informationKey,
		feedbackMessage,
		feedbackTone = "info",
		guide,
		onClose,
		sidebar,
		children,
	}: PrivilegedToolWorkspaceViewProps = $props();
</script>

<PrivilegedToolRightSheet {id} {title} {subtitle} {informationKey} {onClose}>
	<div class="privileged-tool-workspace-view">
		<aside class="privileged-tool-workspace-view__guide">
			<PrivilegedProductLookup />
			<PrivilegedWorkspaceGuide {...guide} />
			{#if sidebar}
				{@render sidebar()}
			{/if}
		</aside>
		<div class="privileged-tool-workspace-view__content">
			{#if feedbackMessage}
				<StatusMessage tone={feedbackTone} message={feedbackMessage} />
			{/if}
			{@render children()}
		</div>
	</div>
</PrivilegedToolRightSheet>

<style lang="scss">
	@use "./PrivilegedToolWorkspaceView.scss";
</style>
