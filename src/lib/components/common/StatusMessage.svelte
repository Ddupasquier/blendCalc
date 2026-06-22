<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		tone = "info",
		title = "",
		children,
	}: {
		tone?: "info" | "success" | "warning" | "danger";
		title?: string;
		children?: Snippet;
	} = $props();
</script>

<div class="status-message" data-tone={tone} role={tone === "danger" ? "alert" : "status"}>
	<span class="status-message__icon" aria-hidden="true">
		{tone === "success" ? "✓" : tone === "danger" ? "!" : tone === "warning" ? "!" : "i"}
	</span>
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
	@use "../../../styles/variables" as *;

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

	.status-message__icon {
		display: inline-grid;
		place-items: center;
		width: 1.25rem;
		height: 1.25rem;
		color: $app-primary;
		background: $app-accent;
		border-radius: 50%;
		font-size: $app-font-size-xs;
		font-weight: $app-font-weight-heavy;
		line-height: 1;
	}

	.status-message[data-tone="success"] .status-message__icon {
		background: $app-success-bg;
	}

	.status-message[data-tone="warning"] .status-message__icon {
		background: $app-highlight;
	}

	.status-message[data-tone="danger"] .status-message__icon {
		background: $app-danger-bg;
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
