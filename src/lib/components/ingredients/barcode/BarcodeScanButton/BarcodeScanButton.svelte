<script lang="ts">
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import BarcodeScannerIcon from "$lib/components/ingredients/barcode/BarcodeScannerIcon/BarcodeScannerIcon.svelte";
	import type { BarcodeScanButtonProps } from "./types";

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
	@use "./BarcodeScanButton.scss";
</style>
