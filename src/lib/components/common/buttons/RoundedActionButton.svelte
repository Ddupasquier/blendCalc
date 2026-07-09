<script lang="ts">
	import PrivilegedActionBadge from "$lib/components/common/badges/PrivilegedActionBadge.svelte";
	import type { RoundedActionButtonProps } from "$lib/components/common/buttons/types";

	let {
		type = "button",
		variant = "primary",
		fullWidth = false,
		busy = false,
		disabled = false,
		privileged = false,
		ariaLabel,
		onclick,
		children,
	}: RoundedActionButtonProps = $props();
</script>

<button
	{type}
	class="rounded-action-button"
	class:rounded-action-button--full={fullWidth}
	data-variant={variant}
	aria-label={ariaLabel}
	aria-busy={busy}
	disabled={disabled || busy}
	{onclick}
>
	{#if privileged}
		<PrivilegedActionBadge />
	{/if}
	{#if children}
		{@render children()}
	{/if}
</button>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.rounded-action-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: $app-gap-xs;
		min-width: 0;
		min-height: $ingredient-control-height;
		padding: 0 $ingredient-control-padding-x;
		border: 2px solid transparent;
		border-radius: $ingredient-radius-control;
		font-family: $app-button-font-family;
		font-size: $app-font-size-md;
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
			opacity: 0.68;
		}
	}

	.rounded-action-button--full {
		width: 100%;
	}

	.rounded-action-button[data-variant="primary"] {
		color: $ingredient-surface-card;
		background: $ingredient-accent-primary;
		border-color: $ingredient-accent-primary;

		&:hover:not(:disabled) {
			background: color-mix(
				in srgb,
				$ingredient-accent-primary 88%,
				$ingredient-text-primary
			);
			border-color: color-mix(
				in srgb,
				$ingredient-accent-primary 88%,
				$ingredient-text-primary
			);
		}
	}

	.rounded-action-button[data-variant="outline"] {
		color: $ingredient-accent-primary;
		background: transparent;
		border-color: $ingredient-accent-primary;

		&:hover:not(:disabled) {
			color: $ingredient-surface-card;
			background: $ingredient-accent-primary;
		}
	}

	.rounded-action-button[data-variant="quiet"] {
		color: $ingredient-text-muted;
		background: $ingredient-surface-control;
		border-color: $ingredient-surface-control;
	}

	.rounded-action-button[data-variant="soft"] {
		color: $ingredient-accent-primary;
		background: $ingredient-surface-positive;
		border-color: $ingredient-surface-positive;
	}

	.rounded-action-button[data-variant="neutral"] {
		color: $ingredient-text-primary;
		background: $ingredient-surface-card;
		border-color: $ingredient-border-subtle;
	}

	.rounded-action-button[data-variant="dashed"] {
		color: $ingredient-accent-primary;
		background: transparent;
		border-style: dashed;
		border-color: color-mix(in srgb, $ingredient-accent-primary 45%, white);
	}
</style>
