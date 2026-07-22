<script lang="ts">
	import CircularMediaFrame from "$lib/components/common/images/CircularMediaFrame/CircularMediaFrame.svelte";
	import ImagePlacementViewport from "$lib/components/common/images/ImagePlacementViewport/ImagePlacementViewport.svelte";
	import type { ImagePlacementCardPreviewProps } from "./types";

	let {
		imageUrl,
		alt,
		value,
		ariaLabel = "Card image preview",
		size = "card",
		interactive = false,
		instructionsId = undefined,
		onChange,
		onGeometryChange,
		onError,
	}: ImagePlacementCardPreviewProps = $props();
</script>

<CircularMediaFrame class={`image-placement-card-preview image-placement-card-preview--${size}`} label={ariaLabel}>
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
</CircularMediaFrame>

<style lang="scss">
	@use "./ImagePlacementCardPreview.scss";
</style>
