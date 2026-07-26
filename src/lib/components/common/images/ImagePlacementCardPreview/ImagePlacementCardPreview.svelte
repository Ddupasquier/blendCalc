<script lang="ts">
	import Chevron from "$lib/assets/icons/Chevron/Chevron.svelte";
	import DotsHorizontal from "$lib/assets/icons/DotsHorizontal/DotsHorizontal.svelte";
	import X from "$lib/assets/icons/X/X.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame/CircularIconFrame.svelte";
	import IngredientCardFeatureImage from "$lib/components/ingredients/card/IngredientCardFeatureImage/IngredientCardFeatureImage.svelte";
	import type { ImagePlacementCardPreviewProps } from "./types";

	let {
		imageUrl,
		alt,
		value,
		foodName = "Product name",
		category = "Ingredient category",
		ariaLabel = "Card image preview",
		interactive = false,
		instructionsId = undefined,
		onChange,
		onGeometryChange,
		onError,
	}: ImagePlacementCardPreviewProps = $props();
</script>

<div class="image-placement-card-preview" role="group" aria-label={ariaLabel}>
	<IngredientCardFeatureImage
		{imageUrl}
		{alt}
		{value}
		{interactive}
		{instructionsId}
		{onChange}
		{onGeometryChange}
		{onError}
	/>
	<span class="image-placement-card-preview__copy">
		<strong>{foodName}</strong>
		<small>{category}</small>
	</span>
	<span class="image-placement-card-preview__actions" aria-hidden="true">
		<CircularIconFrame
			class="image-placement-card-preview__action image-placement-card-preview__action--primary"
			decorative
		>
			<Chevron direction="right" />
		</CircularIconFrame>
		<CircularIconFrame class="image-placement-card-preview__action" decorative>
			<DotsHorizontal />
		</CircularIconFrame>
		<CircularIconFrame class="image-placement-card-preview__action" decorative>
			<X />
		</CircularIconFrame>
	</span>
</div>

<style lang="scss">
	@use "./ImagePlacementCardPreview.scss";
</style>
