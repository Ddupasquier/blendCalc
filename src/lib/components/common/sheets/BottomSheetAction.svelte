<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		label,
		variant = "default",
		disabled = false,
		icon,
		onSelect,
	}: {
		label: string;
		variant?: "default" | "move" | "danger";
		disabled?: boolean;
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
	<span class="bottom-sheet-action__icon" aria-hidden="true">
		{#if icon}
			{@render icon()}
		{/if}
	</span>
	<span>{label}</span>
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
		color: $color-figma-sky;
		text-align: left;
		background: $color-figma-canvas;
		border: 0;
		border-radius: $app-rebuild-radius;
		font-family: $app-button-font-family;
		font-size: $app-font-size-md;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
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
		color: $color-figma-red;
	}

	.bottom-sheet-action__icon {
		display: inline-grid;
		place-items: center;
		width: $app-rebuild-food-icon-size;
		height: $app-rebuild-food-icon-size;
		background: color-mix(in srgb, currentColor 12%, $color-figma-card);
		border-radius: $app-radius;

		:global(svg) {
			width: 1.1rem;
			height: 1.1rem;
		}
	}
</style>
