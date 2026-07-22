<script lang="ts">
	import WarningTriangle from "$lib/assets/icons/WarningTriangle/WarningTriangle.svelte";
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
		role={tone === "error" ? "alert" : "status"}
		aria-live="polite"
	>
		<span class="warning-popup__icon" aria-hidden="true">
			<WarningTriangle size={16} />
		</span>
		<span>{message}</span>
	</div>
{/if}

<style lang="scss">
	@use "./WarningPopup.scss";
</style>
