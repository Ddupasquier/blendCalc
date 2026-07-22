<script lang="ts">
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import CenteredIcon from "$lib/components/common/icons/CenteredIcon/CenteredIcon.svelte";
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
	<CenteredIcon class="barcode-scan-button__icon">
		{#if scanning}
			<LoadingSpinner size="small" decorative />
		{:else}
			<BarcodeScannerIcon />
		{/if}
	</CenteredIcon>
	<span class="barcode-scan-button__label" class:sr-only={compact}>Scan</span>
</button>

<style lang="scss">
	@use "./BarcodeScanButton.scss";
</style>
