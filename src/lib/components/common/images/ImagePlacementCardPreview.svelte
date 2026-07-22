<script lang="ts">
	import CircularMediaFrame from "$lib/components/common/images/CircularMediaFrame.svelte";
	import ImagePlacementViewport from "$lib/components/common/images/ImagePlacementViewport.svelte";
	import type { ImagePlacementCardPreviewProps } from "$lib/components/common/images/types";

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
	@use "../../../../styles/variables" as *;

	:global(.image-placement-card-preview) {
		--circular-media-frame-background: #{$app-shell-accent-soft};
	}

	:global(.image-placement-card-preview--card) {
		--circular-media-frame-size: #{$app-shell-leading-icon-size};
	}

	:global(.image-placement-card-preview--editor) {
		--circular-media-frame-size: #{8rem};
	}
</style>
