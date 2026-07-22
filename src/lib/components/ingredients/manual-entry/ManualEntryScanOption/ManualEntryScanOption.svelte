<script lang="ts">
	import BarcodeScanButton from "$lib/components/ingredients/barcode/BarcodeScanButton/BarcodeScanButton.svelte";
	import type { ManualEntryScanOptionProps } from "./types";

	let {
		scanning = false,
		disabled = false,
		onScan,
	}: ManualEntryScanOptionProps = $props();
</script>

<section
	class="custom-ingredient__scan-option"
	aria-label="Scan a package barcode"
>
	<BarcodeScanButton
		{scanning}
		{disabled}
		onclick={onScan}
	/>
	<small>Scan a barcode for fastest entry</small>
</section>

<style lang="scss">
	@use "./ManualEntryScanOption.scss";
</style>
