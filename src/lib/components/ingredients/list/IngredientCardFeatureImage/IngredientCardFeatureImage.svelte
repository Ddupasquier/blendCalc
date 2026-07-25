<script lang="ts">
	import ImagePlacementViewport from "$lib/components/common/images/ImagePlacementViewport/ImagePlacementViewport.svelte";
	import type { IngredientCardFeatureImageProps } from "./types";

	let {
		imageUrl,
		alt,
		value,
		interactive = false,
		decorative = false,
		instructionsId,
		onChange,
		onGeometryChange,
		onError,
	}: IngredientCardFeatureImageProps = $props();
</script>

<span
	class="ingredient-card-feature-image"
	class:ingredient-card-feature-image--interactive={interactive}
	aria-hidden={decorative ? "true" : undefined}
>
	<ImagePlacementViewport
		{imageUrl}
		{alt}
		{value}
		{interactive}
		{instructionsId}
		{onChange}
		{onGeometryChange}
		{onError}
	/>
</span>

<style lang="scss">
	@use "./IngredientCardFeatureImage.scss";
</style>
