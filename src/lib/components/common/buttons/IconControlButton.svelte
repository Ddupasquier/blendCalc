<script lang="ts">
	import CenteredIcon from "$lib/components/common/icons/CenteredIcon.svelte";
	import type { IconControlButtonProps } from "./types";

	let {
		type = "button",
		label,
		active = false,
		busy = false,
		disabled = false,
		class: className = "",
		"aria-expanded": ariaExpanded = undefined,
		"aria-controls": ariaControls = undefined,
		onclick,
		children,
	}: IconControlButtonProps = $props();
</script>

<button
	{type}
	class={`icon-control-button ${className}`.trim()}
	class:icon-control-button--active={active}
	aria-label={label}
	aria-busy={busy}
	aria-expanded={ariaExpanded}
	aria-controls={ariaControls}
	disabled={disabled || busy}
	{onclick}
>
	<CenteredIcon>
		{#if children}
			{@render children()}
		{/if}
	</CenteredIcon>
</button>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.icon-control-button {
		display: inline-grid;
		place-items: center;
		width: $ingredient-control-height;
		height: $ingredient-control-height;
		flex: 0 0 auto;
		padding: 0;
		color: $ingredient-text-muted;
		background: $ingredient-surface-control;
		border: 0;
		border-radius: $ingredient-radius-control;
		transition:
			color 160ms ease,
			background-color 160ms ease,
			transform 120ms ease,
			opacity 160ms ease;

		&:hover:not(:disabled),
		&--active {
			color: $ingredient-accent-primary;
			background: $ingredient-surface-positive;
		}

		&:active:not(:disabled) {
			transform: scale(0.97);
		}

		&:focus-visible {
			outline: $app-focus-outline;
			outline-offset: $app-focus-outline-offset;
		}

		&:disabled {
			cursor: not-allowed;
			opacity: 0.7;
		}
	}

</style>
