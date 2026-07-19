<script lang="ts">
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner.svelte";
	import type { ActionButtonProps } from "./types";

	let {
		type = "button",
		variant = "primary",
		size = "medium",
		fullWidth = false,
		busy = false,
		disabled = false,
		ariaLabel,
		onclick,
		children,
		leading,
		trailing,
	}: ActionButtonProps = $props();
</script>

<button
	{type}
	class="action-button"
	class:action-button--full={fullWidth}
	class:action-button--busy={busy}
	data-variant={variant}
	data-size={size}
	aria-label={ariaLabel}
	aria-busy={busy}
	disabled={disabled || busy}
	{onclick}
>
	{#if busy}
		<span class="action-button__icon">
			<LoadingSpinner size="small" decorative />
		</span>
	{:else if leading}
		<span class="action-button__icon" aria-hidden="true">{@render leading()}</span>
	{/if}
	<span class="action-button__label">
		{#if children}
			{@render children()}
		{/if}
	</span>
	{#if trailing && !busy}
		<span class="action-button__icon" aria-hidden="true">{@render trailing()}</span>
	{/if}
</button>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.action-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: $app-gap-xs;
		min-width: 0;
		min-height: $app-control-height;
		color: $app-btn-text;
		background: $app-btn-bg;
		border: 1.5px solid transparent;
		border-radius: $app-radius-pill;
		font-family: $app-button-font-family;
		font-size: $app-font-size-md;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
		text-align: center;
		text-decoration: none;
		transition:
			background 0.16s ease,
			border-color 0.16s ease,
			color 0.16s ease,
			opacity 0.16s ease,
			transform 0.1s ease;
	}

	.action-button--full {
		width: 100%;
	}

	.action-button[data-size="small"] {
		min-height: $app-control-height-sm;
		padding: $app-action-button-padding-y-sm $app-action-button-padding-x-sm;
		font-size: $app-font-size-sm;
	}

	.action-button[data-size="medium"] {
		padding: $app-action-button-padding-y-md $app-action-button-padding-x-md;
	}

	.action-button[data-size="large"] {
		min-height: $app-action-button-height-lg;
		padding: $app-action-button-padding-y-lg $app-action-button-padding-x-lg;
		font-size: $app-font-size-lg;
	}

	.action-button[data-variant="primary"] {
		color: $app-btn-text;
		background: $app-btn-bg;

		&:hover:not(:disabled) {
			background: $app-btn-bg-hover;
		}
	}

	.action-button[data-variant="secondary"] {
		color: $app-primary;
		background: $app-accent;
		border-color: $app-accent;
	}

	.action-button[data-variant="highlight"] {
		color: $app-highlight-text;
		background: $app-highlight;

		&:hover:not(:disabled) {
			background: $app-highlight-hover;
		}
	}

	.action-button[data-variant="success"] {
		color: $color-figma-card;
		background: $color-figma-green;
	}

	.action-button[data-variant="danger"] {
		color: $app-btn-text;
		background: $app-danger-action;
	}

	.action-button[data-variant="ghost"] {
		color: $app-primary;
		background: transparent;
		border-color: $color-orchid-mist;
	}

	.action-button:focus-visible {
		outline: $app-focus-outline;
		outline-offset: 2px;
	}

	.action-button:active:not(:disabled) {
		transform: scale(0.98);
	}

	.action-button:disabled,
	.action-button--busy {
		cursor: not-allowed;
		opacity: 0.65;
	}

	.action-button__label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.action-button__icon {
		display: inline-grid;
		flex: 0 0 auto;
		place-items: center;
		width: 1em;
		height: 1em;
	}
</style>
