<script lang="ts">
	import ImagePlacementViewport from "$lib/components/common/images/ImagePlacementViewport/ImagePlacementViewport.svelte";
	import type { IngredientCardFeatureImageProps } from "./types";

	let {
		imageUrl,
		alt,
		value,
		fallback,
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
	class:ingredient-card-feature-image--fallback={!imageUrl || !value}
	aria-hidden={decorative ? "true" : undefined}
>
	{#if imageUrl && value}
		<ImagePlacementViewport
			{imageUrl}
			alt={alt ?? ""}
			{value}
			{interactive}
			{instructionsId}
			{onChange}
			{onGeometryChange}
			{onError}
		/>
	{:else if fallback}
		{@render fallback()}
	{/if}
</span>

<style lang="scss">
	@use "./IngredientCardFeatureImage.scss";
</style>
