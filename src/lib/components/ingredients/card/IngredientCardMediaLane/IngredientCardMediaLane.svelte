<script lang="ts">
	import ImagePlacementViewport from "$lib/components/common/images/ImagePlacementViewport/ImagePlacementViewport.svelte";
	import type { IngredientCardMediaLaneProps } from "./types";

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
	}: IngredientCardMediaLaneProps = $props();
</script>

<span
	class="ingredient-card-media-lane"
	class:ingredient-card-media-lane--interactive={interactive}
	class:ingredient-card-media-lane--fallback={!imageUrl || !value}
	aria-hidden={decorative ? "true" : undefined}
>
	{#if imageUrl && value}
		<ImagePlacementViewport
			{imageUrl}
			alt={alt ?? ""}
			{value}
			horizontalMovement="left-only"
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
	@use "./IngredientCardMediaLane.scss";
</style>
