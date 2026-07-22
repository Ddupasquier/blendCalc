<script lang="ts">
	import Barcode from "$lib/assets/icons/Barcode/Barcode.svelte";
	import type { BarcodeScannerIconProps } from "./types";

	const barcodeBars = [
		2, 2, 6, 1, 9, 3, 14, 1, 17, 2, 21, 1, 24, 3, 29, 1, 32, 2, 36, 1, 39,
		3, 44, 2,
	];
	const barcodeBarIndexes = Array.from(
		{ length: barcodeBars.length / 2 },
		(_, index) => index,
	);

	let {
		active = false,
	}: BarcodeScannerIconProps = $props();
</script>

<span class="barcode-scanner" class:barcode-scanner--active={active} aria-hidden="true">
	{#if active}
		<span class="barcode-scanner__bracket barcode-scanner__bracket--top-left"></span>
		<span class="barcode-scanner__bracket barcode-scanner__bracket--top-right"></span>
		<span class="barcode-scanner__bracket barcode-scanner__bracket--bottom-left"></span>
		<span class="barcode-scanner__bracket barcode-scanner__bracket--bottom-right"></span>
		<svg
			class="barcode-scanner__bars"
			viewBox="0 0 48 28"
			width="48"
			height="28"
		>
			{#each barcodeBarIndexes as index}
				<rect
					x={barcodeBars[index * 2]}
					y="0"
					width={barcodeBars[index * 2 + 1]}
					height="28"
					fill="currentColor"
				/>
			{/each}
		</svg>
		<span class="barcode-scanner__glow"></span>
		<span class="barcode-scanner__laser"></span>
	{:else}
		<Barcode class="barcode-scanner__idle-bars" />
	{/if}
</span>

<style lang="scss">
	@use "./BarcodeScannerIcon.scss";
</style>
