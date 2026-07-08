<script lang="ts">
	import PillButton from "$lib/components/common/buttons/PillButton.svelte";

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
		<PillButton disabled={moving} onclick={onClear}>Uncheck all</PillButton>
		<PillButton variant="primary" busy={moving} onclick={onMove}>
			{moving
				? "Moving…"
				: `Move ${selectedCount} checked → ${moveTargetLabel}`}
		</PillButton>
	{:else}
		<PillButton disabled={moving} onclick={onSelectAll}>Check all</PillButton>
	{/if}
</div>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.ingredient-bulk-actions {
		display: flex;
		flex: 0 0 auto;
		flex-wrap: wrap;
		align-items: center;
		gap: $app-horizontal-control-gap;
		min-height: 0;
	}

	@media (max-width: $app-breakpoint-xs) {
		.ingredient-bulk-actions :global(.pill-button[data-variant="primary"]) {
			width: 100%;
		}
	}
</style>
