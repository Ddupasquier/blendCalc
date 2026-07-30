<script lang="ts">
	import PillButton from "$lib/components/common/buttons/PillButton/PillButton.svelte";
	import type { BarcodeAutofillSuggestionProps } from "./types";

	let {
		name,
		brandOwner,
		sourceLabel,
		heading = `Autofill available from ${sourceLabel}`,
		description = "",
		applyLabel = "Autofill",
		keepLabel = "Keep mine",
		extraLabel,
		tone = "default",
		onApply,
		onKeepManual,
		onExtra,
	}: BarcodeAutofillSuggestionProps = $props();
</script>

<div
	class="barcode-suggestion"
	class:barcode-suggestion--error={tone === "error"}
	role={tone === "error" ? "alert" : "status"}
>
	<div>
		<strong>{heading}</strong>
		<span>
			{name}
			{#if brandOwner}
				· {brandOwner}
			{/if}
		</span>
		{#if description}
			<p>{description}</p>
		{/if}
	</div>
	<div class="barcode-suggestion__actions">
		<PillButton variant="primary" onclick={onApply}>
			{applyLabel}
		</PillButton>
		<PillButton onclick={onKeepManual}>
			{keepLabel}
		</PillButton>
		{#if extraLabel && onExtra}
			<PillButton onclick={onExtra}>
				{extraLabel}
			</PillButton>
		{/if}
	</div>
</div>

<style lang="scss">
	@use "./BarcodeAutofillSuggestion.scss";
</style>
