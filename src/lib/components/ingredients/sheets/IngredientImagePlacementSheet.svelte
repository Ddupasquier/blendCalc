<script lang="ts">
	import BottomSheet from "$lib/components/common/sheets/BottomSheet.svelte";
	import ProductImagePanel from "$lib/components/ingredients/nutrition/ProductImagePanel.svelte";
	import type { IngredientImagePlacementSheetProps } from "$lib/components/ingredients/sheets/types";

	let {
		open,
		food,
		canAdjustImagePlacement,
		onClose,
		onImagePlacementSave,
	}: IngredientImagePlacementSheetProps = $props();
</script>

<BottomSheet
	{open}
	title="Image placement"
	titleId="ingredient-image-placement-sheet-title"
	label="Ingredient image placement"
	onClose={onClose}
>
	{#if food?.image}
		<ProductImagePanel
			{food}
			{canAdjustImagePlacement}
			{onImagePlacementSave}
		/>
	{:else}
		<p class="ingredient-image-placement-sheet__empty">
			This ingredient does not have a saved product image yet.
		</p>
	{/if}
</BottomSheet>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.ingredient-image-placement-sheet__empty {
		margin: 0;
		color: $ingredient-text-muted;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-bold;
		line-height: 1.35;
	}
</style>
