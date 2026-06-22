<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		eyebrow = "",
		title = "",
		description = "",
		tone = "default",
		compact = false,
		children,
		actions,
	}: {
		eyebrow?: string;
		title?: string;
		description?: string;
		tone?: "default" | "info" | "warning" | "danger" | "success";
		compact?: boolean;
		children?: Snippet;
		actions?: Snippet;
	} = $props();
</script>

<section class="panel" class:panel--compact={compact} data-tone={tone}>
	{#if eyebrow || title || description || actions}
		<header class="panel__header">
			<div class="panel__copy">
				{#if eyebrow}
					<p class="panel__eyebrow">{eyebrow}</p>
				{/if}
				{#if title}
					<h2>{title}</h2>
				{/if}
				{#if description}
					<p class="panel__description">{description}</p>
				{/if}
			</div>
			{#if actions}
				<div class="panel__actions">
					{@render actions()}
				</div>
			{/if}
		</header>
	{/if}

	{#if children}
		<div class="panel__body">
			{@render children()}
		</div>
	{/if}
</section>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.panel {
		display: grid;
		gap: $app-gap-md;
		width: 100%;
		min-width: 0;
		padding: $app-padding;
		color: $app-primary;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-card-radius;
	}

	.panel--compact {
		gap: $app-gap-sm;
		padding: $app-gap-md;
	}

	.panel[data-tone="info"] {
		background: $app-bg;
	}

	.panel[data-tone="warning"] {
		background: $app-warning-bg;
		border: $app-warning-border;
	}

	.panel[data-tone="danger"] {
		background: color-mix(in srgb, $app-danger-bg 36%, $app-section-bg);
		border-color: $app-danger-bg;
	}

	.panel[data-tone="success"] {
		background: color-mix(in srgb, $app-success-bg 42%, $app-section-bg);
		border-color: $app-success-bg;
	}

	.panel__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: $app-gap-md;
		min-width: 0;
	}

	.panel__copy,
	.panel__body {
		min-width: 0;
	}

	.panel__eyebrow {
		margin-bottom: $app-gap-xs;
		color: $app-muted;
		font-size: $app-font-size-xs;
		font-weight: $app-font-weight-heavy;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	h2 {
		color: $app-primary;
		font-family: $app-font-family-display;
		font-size: $app-font-size-xl;
		font-weight: $app-font-weight-bold;
	}

	.panel__description {
		margin-top: $app-gap-xs;
		color: $app-muted;
		font-size: $app-font-size-md;
		line-height: 1.4;
	}

	.panel__actions {
		display: flex;
		flex: 0 0 auto;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: $app-gap-xs;
	}

	@media (max-width: $app-breakpoint-xs) {
		.panel {
			padding: $app-gap-md;
		}

		.panel__header {
			display: grid;
			gap: $app-gap-sm;
		}

		.panel__actions {
			justify-content: flex-start;
		}
	}
</style>
