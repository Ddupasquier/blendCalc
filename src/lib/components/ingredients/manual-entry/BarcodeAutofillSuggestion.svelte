<script lang="ts">
	import PillButton from "$lib/components/common/buttons/PillButton.svelte";
	import type { BarcodeAutofillSuggestionProps } from "$lib/components/ingredients/manual-entry/formTypes";

	let {
		name,
		brandOwner,
		sourceLabel,
		onApply,
		onKeepManual,
	}: BarcodeAutofillSuggestionProps = $props();
</script>

<div class="barcode-suggestion" role="status">
	<div>
		<strong>Autofill available from {sourceLabel}</strong>
		<span>
			{name}
			{#if brandOwner}
				· {brandOwner}
			{/if}
		</span>
	</div>
	<div class="barcode-suggestion__actions">
		<PillButton variant="primary" onclick={onApply}>
			Autofill
		</PillButton>
		<PillButton onclick={onKeepManual}>
			Keep mine
		</PillButton>
	</div>
</div>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.barcode-suggestion {
		display: grid;
		gap: $app-gap-sm;
		margin-top: $app-gap-sm;
		padding: $app-gap-md;
		border: 1px solid $ingredient-border-subtle;
		border-radius: $ingredient-radius-card;
		background: $ingredient-surface-soft;
		color: $ingredient-text-primary;

		strong,
		span {
			display: block;
		}

		strong {
			font-size: $app-font-size-sm;
			font-weight: $app-font-weight-bold;
		}

		span {
			color: $ingredient-text-muted;
			font-size: $app-font-size-sm;
		}
	}

	.barcode-suggestion__actions {
		display: flex;
		flex-wrap: wrap;
		gap: $app-gap-xs;
	}
</style>
