<script lang="ts">
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner.svelte";
	import BarcodeScannerIcon from "$lib/components/ingredients/barcode/BarcodeScannerIcon.svelte";
	import type { BarcodeScanButtonProps } from "$lib/components/ingredients/barcode/types";

	let {
		scanning = false,
		disabled = false,
		compact = false,
		onclick,
	}: BarcodeScanButtonProps = $props();
</script>

<button
	class="barcode-scan-button"
	class:barcode-scan-button--compact={compact}
	type="button"
	disabled={disabled || scanning}
	aria-busy={scanning}
	aria-label={scanning ? "Scanning barcode" : "Scan barcode"}
	{onclick}
>
	{#if scanning}
		<LoadingSpinner size="small" decorative />
	{:else}
		<BarcodeScannerIcon />
	{/if}
	<span class="barcode-scan-button__label" class:sr-only={compact}>Scan</span>
</button>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.barcode-scan-button {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		gap: $app-gap-xs;
		width: auto;
		min-height: $ingredient-control-height;
		padding: $ingredient-scan-button-padding-y $ingredient-scan-button-padding-x;
		color: $ingredient-surface-card;
		background-color: $ingredient-accent-primary;
		border: 0;
		border-radius: $ingredient-radius-card;
		transition:
			background-color 0.28s ease,
			color 0.28s ease;

		.barcode-scan-button__label {
			position: relative;
			z-index: 1;
			white-space: nowrap;
		}

		&:hover:not(:disabled) {
			background-color: color-mix(
				in srgb,
				$ingredient-accent-primary 88%,
				$ingredient-text-primary
			);
		}

		&:disabled {
			cursor: wait;
			opacity: 1;
		}
	}

	.barcode-scan-button--compact {
		width: $ingredient-control-height;
		height: $ingredient-control-height;
		min-height: $ingredient-control-height;
		padding: 0;
		flex-shrink: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.barcode-scan-button {
			transition: none;
		}
	}
</style>
