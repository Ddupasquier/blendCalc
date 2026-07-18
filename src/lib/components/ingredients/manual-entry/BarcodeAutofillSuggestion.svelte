<script lang="ts">
	import PillButton from "$lib/components/common/buttons/PillButton.svelte";
	import type { BarcodeAutofillSuggestionProps } from "$lib/components/ingredients/manual-entry/formTypes";

	let {
		name,
		brandOwner,
		sourceLabel,
		heading = `Autofill available from ${sourceLabel}`,
		description = "",
		applyLabel = "Autofill",
		keepLabel = "Keep mine",
		tone = "default",
		onApply,
		onKeepManual,
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

		p {
			margin: $app-gap-xs 0 0;
			font-size: $app-font-size-sm;
			line-height: 1.35;
		}
	}

	.barcode-suggestion--error {
		border-color: $ingredient-status-error-text;
		background: $ingredient-status-error-bg;
		color: $ingredient-status-error-text;

		span,
		p {
			color: inherit;
		}
	}

	.barcode-suggestion__actions {
		display: flex;
		flex-wrap: wrap;
		gap: $app-gap-xs;
	}
</style>
