<script lang="ts">
	import BarcodeScanButton from "$lib/components/ingredients/barcode/BarcodeScanButton.svelte";

	let {
		scanning = false,
		disabled = false,
		onScan,
	}: {
		scanning?: boolean;
		disabled?: boolean;
		onScan: () => void;
	} = $props();
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
	@use "../../../../styles/variables" as *;

	.custom-ingredient__scan-option {
		display: grid;
		justify-items: end;
		gap: $app-gap-xs;

		small {
			color: $ingredient-text-muted;
			font-size: $app-font-size-xs;
			font-weight: $app-font-weight-medium;
		}
	}
</style>
