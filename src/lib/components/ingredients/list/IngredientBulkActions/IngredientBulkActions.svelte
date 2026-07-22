<script lang="ts">
	import PillButton from "$lib/components/common/buttons/PillButton/PillButton.svelte";
	import type { IngredientBulkActionsProps } from "./types";

	let {
		selectionMode,
		selectedCount,
		selectableCount,
		moveTargetLabel,
		moving = false,
		onEnterSelection,
		onSelectAll,
		onCancel,
		onMove,
	}: IngredientBulkActionsProps = $props();
</script>

<div class="ingredient-bulk-actions" class:ingredient-bulk-actions--active={selectionMode}>
	{#if selectionMode}
		<PillButton disabled={moving} onclick={onCancel}>Cancel</PillButton>
		{#if selectedCount < selectableCount}
			<PillButton disabled={moving} onclick={onSelectAll}>Select all</PillButton>
		{/if}
		{#if selectedCount > 0}
			<PillButton variant="primary" busy={moving} onclick={onMove}>
				Move {selectedCount} selected → {moveTargetLabel}
			</PillButton>
		{/if}
	{:else}
		<PillButton disabled={moving} onclick={onEnterSelection}>Select items</PillButton>
	{/if}
</div>

<style lang="scss">
	@use "./IngredientBulkActions.scss";
</style>
