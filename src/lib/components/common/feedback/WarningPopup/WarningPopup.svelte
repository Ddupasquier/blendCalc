<script lang="ts">
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import type { WarningPopupProps } from "./types";

	let {
		message,
		open = true,
		tone = "warning",
	}: WarningPopupProps = $props();
</script>

{#if open && message}
	<div
		class="warning-popup warning-popup--{tone}"
	>
		<StatusMessage
			tone={tone === "error" ? "danger" : "warning"}
			{message}
		/>
	</div>
{/if}
