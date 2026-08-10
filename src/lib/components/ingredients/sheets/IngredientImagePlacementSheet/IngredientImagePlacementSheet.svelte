<script lang="ts">
	import BottomSheet from "$lib/components/common/sheets/BottomSheet/BottomSheet.svelte";
	import ProductImagePanel from "$lib/components/ingredients/nutrition/ProductImagePanel/ProductImagePanel.svelte";
	import type { IngredientImagePlacementSheetProps } from "./types";

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
	title="Adjust image placement"
	titleId="ingredient-image-placement-sheet-title"
	label="Ingredient image placement"
	fill
	onClose={onClose}
>
	{#if food?.image}
		<ProductImagePanel
			{food}
			mode="details"
			placementPresentation="flat"
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
	@use "./IngredientImagePlacementSheet.scss";
</style>
