<script lang="ts">
	let {
		name,
		brandOwner,
		sourceLabel,
		onApply,
		onKeepManual,
	}: {
		name: string;
		brandOwner?: string;
		sourceLabel: string;
		onApply: () => void;
		onKeepManual: () => void;
	} = $props();
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
		<button
			type="button"
			class="barcode-suggestion__action barcode-suggestion__action--primary"
			onclick={onApply}
		>
			Autofill
		</button>
		<button
			type="button"
			class="barcode-suggestion__action"
			onclick={onKeepManual}
		>
			Keep mine
		</button>
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

	.barcode-suggestion__action {
		min-height: $ingredient-control-height-compact;
		padding: $ingredient-control-padding-y-compact $ingredient-control-padding-x;
		border: 0;
		border-radius: $ingredient-radius-pill;
		background: $ingredient-surface-control;
		color: $ingredient-text-primary;
		font: inherit;
		font-weight: $app-font-weight-bold;
		cursor: pointer;
	}

	.barcode-suggestion__action--primary {
		background: $ingredient-accent-primary;
		color: $app-btn-text;
	}
</style>
