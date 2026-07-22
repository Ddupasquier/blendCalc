<script lang="ts">
	import Check from "$lib/assets/icons/Check/Check.svelte";
	import Info from "$lib/assets/icons/Info/Info.svelte";
	import WarningTriangle from "$lib/assets/icons/WarningTriangle/WarningTriangle.svelte";
	import StatusIconBadge from "$lib/components/common/badges/StatusIconBadge/StatusIconBadge.svelte";
	import type { StatusMessageProps } from "./types";

	let {
		tone = "info",
		title = "",
		children,
	}: StatusMessageProps = $props();
</script>

<div class="status-message" data-tone={tone} role={tone === "danger" ? "alert" : "status"}>
	<StatusIconBadge
		label={`${tone} message`}
		tone={tone === "danger" ? "error" : tone}
		decorative
	>
		{#if tone === "success"}
			<Check size="1em" />
		{:else if tone === "info"}
			<Info size="1em" />
		{:else}
			<WarningTriangle size="1em" />
		{/if}
	</StatusIconBadge>
	<div class="status-message__copy">
		{#if title}
			<strong>{title}</strong>
		{/if}
		{#if children}
			<div class="status-message__body">
				{@render children()}
			</div>
		{/if}
	</div>
</div>

<style lang="scss">
	@use "./StatusMessage.scss";
</style>
