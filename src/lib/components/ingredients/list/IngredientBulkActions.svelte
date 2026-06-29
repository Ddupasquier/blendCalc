<script lang="ts">
	let {
		selectedCount,
		moveTargetLabel,
		moving = false,
		onSelectAll,
		onClear,
		onMove,
	}: {
		selectedCount: number;
		moveTargetLabel: string;
		moving?: boolean;
		onSelectAll: () => void;
		onClear: () => void;
		onMove: () => void;
	} = $props();
</script>

<div class="ingredient-bulk-actions" class:ingredient-bulk-actions--active={selectedCount > 0}>
	{#if selectedCount > 0}
		<button type="button" disabled={moving} onclick={onClear}>Uncheck all</button>
		<button
			class="ingredient-bulk-actions__move"
			type="button"
			aria-busy={moving}
			onclick={onMove}
			disabled={moving}
		>
			{moving
				? "Moving…"
				: `Move ${selectedCount} checked → ${moveTargetLabel}`}
		</button>
	{:else}
		<button type="button" disabled={moving} onclick={onSelectAll}>Check all</button>
	{/if}
</div>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.ingredient-bulk-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: $app-horizontal-control-gap;
		min-height: 0;
	}

	button {
		min-height: $ingredient-control-height-compact;
		padding: $ingredient-control-padding-y-compact $ingredient-control-padding-x-compact;
		color: $ingredient-text-primary;
		background: $ingredient-surface-card;
		border: 1px solid $ingredient-border-subtle;
		border-radius: $ingredient-radius-pill;
		font-family: $app-button-font-family;
		font-size: $app-font-size-sm;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
	}

	.ingredient-bulk-actions__move {
		color: $ingredient-surface-card;
		background: $ingredient-accent-primary;
		border-color: transparent;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	@media (max-width: $app-breakpoint-xs) {
		.ingredient-bulk-actions__move {
			width: 100%;
		}
	}
</style>
