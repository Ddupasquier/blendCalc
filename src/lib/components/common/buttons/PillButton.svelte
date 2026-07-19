<script lang="ts">
	import PrivilegedActionBadge from "$lib/components/common/badges/PrivilegedActionBadge.svelte";
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner.svelte";
	import type { PillButtonProps } from "$lib/components/common/buttons/types";

	let {
		type = "button",
		variant = "neutral",
		pressed = undefined,
		busy = false,
		disabled = false,
		fullWidth = false,
		privileged = false,
		ariaLabel,
		onclick,
		children,
	}: PillButtonProps = $props();
</script>

<button
	{type}
	class="pill-button"
	class:pill-button--full={fullWidth}
	data-variant={variant}
	aria-label={ariaLabel}
	aria-pressed={pressed}
	aria-busy={busy}
	disabled={disabled || busy}
	{onclick}
>
	{#if privileged}
		<PrivilegedActionBadge />
	{/if}
	{#if busy}
		<LoadingSpinner size="small" decorative />
	{/if}
	{#if children}
		{@render children()}
	{/if}
</button>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.pill-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: $app-gap-xs;
		min-width: 0;
		min-height: $ingredient-control-height-compact;
		padding: $ingredient-control-padding-y-compact $ingredient-control-padding-x-compact;
		color: $ingredient-text-primary;
		background: $ingredient-surface-card;
		border: 1px solid $ingredient-border-subtle;
		border-radius: $ingredient-radius-pill;
		font-family: $app-button-font-family;
		font-size: $app-font-size-sm;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
		text-align: center;
		transition:
			background-color 160ms ease,
			border-color 160ms ease,
			color 160ms ease,
			opacity 160ms ease,
			transform 120ms ease;

		&:active:not(:disabled) {
			transform: scale(0.98);
		}

		&:focus-visible {
			outline: $app-focus-outline;
			outline-offset: $app-focus-outline-offset;
		}

		&:disabled {
			cursor: not-allowed;
			opacity: 0.55;
		}
	}

	.pill-button--full {
		width: 100%;
	}

	.pill-button[data-variant="primary"] {
		color: $ingredient-surface-card;
		background: $ingredient-accent-primary;
		border-color: transparent;
	}

	.pill-button[data-variant="danger"] {
		color: $app-danger-action;
		background: color-mix(in srgb, $app-danger-action 10%, $ingredient-surface-card);
		border-color: color-mix(in srgb, $app-danger-action 22%, transparent);
	}
</style>
