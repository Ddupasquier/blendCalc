<script lang="ts">
	import ImagePlacementViewport from "$lib/components/common/images/ImagePlacementViewport/ImagePlacementViewport.svelte";
	import { getIngredientCardMediaMaskHorizontalRadiusPixels } from "./ingredientCardMediaFade";
	import type { IngredientCardMediaLaneProps } from "./types";
	import type { ImagePlacementGeometry } from "$lib/utils/food/images/types";

	let {
		imageUrl,
		alt,
		value,
		fallback,
		decorative = false,
		onGeometryChange,
		onError,
	}: IngredientCardMediaLaneProps = $props();

	let placementGeometry = $state<ImagePlacementGeometry | null>(null);
	const maskHorizontalRadiusPixels = $derived(
		placementGeometry
			? getIngredientCardMediaMaskHorizontalRadiusPixels(placementGeometry)
			: null,
	);
	const mediaLaneStyle = $derived(
		maskHorizontalRadiusPixels === null
			? undefined
			: `--ingredient-card-media-mask-horizontal-radius: ${maskHorizontalRadiusPixels}px`,
	);
	const handleGeometryChange = (geometry: ImagePlacementGeometry) => {
		placementGeometry = geometry;
		onGeometryChange?.(geometry);
	};
</script>

<span
	class="ingredient-card-media-lane"
	class:ingredient-card-media-lane--fallback={!imageUrl || !value}
	aria-hidden={decorative ? "true" : undefined}
	style={mediaLaneStyle}
>
	{#if imageUrl && value}
		<ImagePlacementViewport
			{imageUrl}
			alt={alt ?? ""}
			{value}
			horizontalMovement="left-only"
			onGeometryChange={handleGeometryChange}
			{onError}
		/>
	{:else if fallback}
		{@render fallback()}
	{/if}
</span>

<style lang="scss">
	@use "./IngredientCardMediaLane.scss";
</style>
