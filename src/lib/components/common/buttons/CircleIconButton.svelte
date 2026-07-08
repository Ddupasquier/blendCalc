<script lang="ts">
	import type { CircleIconButtonProps } from "./types";

	let {
		type = "button",
		label,
		variant = "primary",
		size = "small",
		busy = false,
		disabled = false,
		pressed = undefined,
		class: className = "",
		onclick,
		onfocus,
		children,
	}: CircleIconButtonProps = $props();
</script>

<button
	{type}
	class={`circle-icon-button ${className}`.trim()}
	data-variant={variant}
	data-size={size}
	aria-label={label}
	aria-busy={busy}
	aria-pressed={pressed}
	disabled={disabled || busy}
	{onclick}
	{onfocus}
>
	{#if busy}
		<span aria-hidden="true">…</span>
	{:else if children}
		{@render children()}
	{/if}
</button>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.circle-icon-button {
		display: inline-grid;
		place-items: center;
		flex: 0 0 auto;
		padding: 0;
		border: 1px solid transparent;
		border-radius: $ingredient-radius-pill;
		font-family: $app-button-font-family;
		font-size: $app-font-size-md;
		font-weight: $app-button-font-weight;
		line-height: 1;
		transition:
			background-color 160ms ease,
			color 160ms ease,
			transform 120ms ease,
			opacity 160ms ease;

		&:active:not(:disabled) {
			transform: scale(0.97);
		}

		&:focus-visible {
			outline: $app-focus-outline;
			outline-offset: $app-focus-outline-offset;
		}

		&:disabled {
			cursor: not-allowed;
			opacity: 0.72;
		}
	}

	.circle-icon-button[data-size="tiny"] {
		width: $app-circle-button-size-tiny;
		height: $app-circle-button-size-tiny;
	}

	.circle-icon-button[data-size="small"] {
		width: $ingredient-action-icon-size;
		height: $ingredient-action-icon-size;
	}

	.circle-icon-button[data-size="control"] {
		width: $ingredient-control-height;
		height: $ingredient-control-height;
	}

	.circle-icon-button[data-size="fab"] {
		width: $ingredient-fab-size;
		height: $ingredient-fab-size;
		border-radius: $ingredient-radius-card;
	}

	.circle-icon-button[data-variant="primary"] {
		color: $ingredient-surface-card;
		background: $ingredient-accent-primary;

		&:hover:not(:disabled) {
			background: color-mix(
				in srgb,
				$ingredient-accent-primary 88%,
				$ingredient-text-primary
			);
		}
	}

	.circle-icon-button[data-variant="soft"] {
		color: $ingredient-text-primary;
		background: $ingredient-surface-control;

		&:hover:not(:disabled) {
			color: $ingredient-accent-primary;
			background: $ingredient-surface-positive;
		}
	}

	.circle-icon-button[data-variant="ghost"] {
		color: $ingredient-text-muted;
		background: transparent;

		&:hover:not(:disabled),
		&:focus-visible {
			color: $ingredient-text-primary;
			background: color-mix(in srgb, $ingredient-surface-card 68%, transparent);
		}
	}

	.circle-icon-button[data-variant="outline"] {
		color: $ingredient-text-muted;
		background: transparent;
		border-color: color-mix(in srgb, $ingredient-text-muted 42%, transparent);

		&:hover:not(:disabled),
		&:focus-visible {
			color: $ingredient-accent-primary;
			border-color: $ingredient-accent-primary;
			background: $ingredient-surface-positive;
		}
	}
</style>
