<script lang="ts">
	import PillButton from "$lib/components/common/buttons/PillButton/PillButton.svelte";
	import type { IngredientBulkActionsProps } from "./types";

	let {
		selectedCount,
		moveTargetLabel,
		moving = false,
		onSelectAll,
		onClear,
		onMove,
	}: IngredientBulkActionsProps = $props();
</script>

<div class="ingredient-bulk-actions" class:ingredient-bulk-actions--active={selectedCount > 0}>
	{#if selectedCount > 0}
		<PillButton disabled={moving} onclick={onClear}>Uncheck all</PillButton>
		<PillButton variant="primary" busy={moving} onclick={onMove}>
			Move {selectedCount} checked → {moveTargetLabel}
		</PillButton>
	{:else}
		<PillButton disabled={moving} onclick={onSelectAll}>Check all</PillButton>
	{/if}
</div>

<style lang="scss">
	@use "./IngredientBulkActions.scss";
</style>
