<script lang="ts">
	import PrivilegedActionBadge from "$lib/components/common/badges/PrivilegedActionBadge/PrivilegedActionBadge.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame.svelte";
	import type { Snippet } from "svelte";

	let {
		label,
		variant = "default",
		disabled = false,
		privileged = false,
		icon,
		onSelect,
	}: {
		label: string;
		variant?: "default" | "move" | "danger";
		disabled?: boolean;
		privileged?: boolean;
		icon?: Snippet;
		onSelect: () => void;
	} = $props();
</script>

<button
	class="bottom-sheet-action"
	class:bottom-sheet-action--move={variant === "move"}
	class:bottom-sheet-action--danger={variant === "danger"}
	type="button"
	{disabled}
	onclick={onSelect}
>
	<CircularIconFrame class="bottom-sheet-action__icon" decorative>
		{#if icon}
			{@render icon()}
		{/if}
	</CircularIconFrame>
	<span class="bottom-sheet-action__label">
		<span>{label}</span>
		{#if privileged}
			<PrivilegedActionBadge />
		{/if}
	</span>
</button>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.bottom-sheet-action {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: $app-gap-sm;
		min-height: 3.8rem;
		padding: $app-gap-sm;
		color: $app-shell-accent-info;
		text-align: left;
		background: $app-shell-surface-page;
		border: 0;
		border-radius: $app-shell-radius-card;
		font-family: $app-button-font-family;
		font-size: $app-font-size-md;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
		touch-action: manipulation;
		cursor: pointer;

		&:disabled {
			cursor: not-allowed;
			opacity: 0.55;
		}

		&:focus-visible {
			outline: $app-focus-outline;
			outline-offset: $app-gap-xs;
		}
	}

	.bottom-sheet-action--move {
		color: $app-warning-strong;
	}

	.bottom-sheet-action--danger {
		color: $app-shell-accent-danger;
	}

	:global(.bottom-sheet-action__icon) {
		--circular-icon-frame-size: #{$app-shell-leading-icon-size};
		--circular-icon-frame-icon-size: #{$app-control-icon-size};
		--circular-icon-frame-color: currentColor;
		--circular-icon-frame-background: color-mix(
			in srgb,
			currentColor 12%,
			#{$app-shell-surface-panel}
		);
		--circular-icon-frame-border: 0;
	}

	.bottom-sheet-action__label {
		display: inline-flex;
		align-items: center;
		gap: $app-gap-xs;
		min-width: 0;
	}
</style>
