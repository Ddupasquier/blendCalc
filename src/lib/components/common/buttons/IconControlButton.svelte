<script lang="ts">
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
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
		{#if busy}
			<LoadingSpinner size="small" decorative />
		{:else if children}
			{@render children()}
		{/if}
	</CenteredIcon>
</button>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.icon-control-button {
		display: inline-grid;
		place-items: center;
		width: $app-shell-control-height;
		height: $app-shell-control-height;
		flex: 0 0 auto;
		padding: 0;
		color: $app-shell-text-muted;
		background: $app-shell-surface-control;
		border: 0;
		border-radius: $app-shell-radius-control;
		transition:
			color 160ms ease,
			background-color 160ms ease,
			transform 120ms ease,
			opacity 160ms ease;

		&:hover:not(:disabled),
		&--active {
			color: $app-shell-accent-primary;
			background: $app-shell-accent-soft;
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
