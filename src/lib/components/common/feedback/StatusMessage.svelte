<script lang="ts">
	import Check from "$lib/assets/icons/Check.svelte";
	import Info from "$lib/assets/icons/Info.svelte";
	import WarningTriangle from "$lib/assets/icons/WarningTriangle.svelte";
	import StatusIconBadge from "$lib/components/common/badges/StatusIconBadge.svelte";
	import type { StatusMessageProps } from "$lib/components/common/feedback/types";

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
	@use "../../../../styles/variables" as *;

	.status-message {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: $app-gap-sm;
		align-items: flex-start;
		width: 100%;
		min-width: 0;
		padding: $app-gap-sm;
		color: $app-primary;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-radius;
		font-family: $app-font-family-interface;
		font-size: $app-font-size-sm;
		line-height: 1.35;
	}

	.status-message[data-tone="success"] {
		background: color-mix(in srgb, $app-success-bg 48%, $app-section-bg);
		border-color: $app-success-bg;
	}

	.status-message[data-tone="warning"] {
		background: $app-warning-bg;
		border-color: $app-warning-border-color;
	}

	.status-message[data-tone="danger"] {
		background: color-mix(in srgb, $app-danger-bg 42%, $app-section-bg);
		border-color: $app-danger-bg;
	}

	.status-message__copy {
		min-width: 0;
	}

	strong {
		display: block;
		margin-bottom: 0.1rem;
		font-weight: $app-font-weight-bold;
	}

	.status-message__body {
		color: $app-muted;
		font-weight: $app-font-weight-medium;
	}
</style>
