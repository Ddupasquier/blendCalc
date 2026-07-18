<script lang="ts">
	import CircularMediaFrame from "$lib/components/common/images/CircularMediaFrame.svelte";
	import { getImagePlacementCssVars } from "$lib/components/common/images/imagePlacementStyle";
	import type { ImagePlacementCardPreviewProps } from "$lib/components/common/images/types";

	let {
		imageUrl,
		alt,
		value,
		ariaLabel = "Card image preview",
	}: ImagePlacementCardPreviewProps = $props();

	const imageStyle = $derived(getImagePlacementCssVars(value, "image-placement-preview"));
</script>

<CircularMediaFrame class="image-placement-card-preview" label={ariaLabel}>
	<img src={imageUrl} {alt} style={imageStyle} />
</CircularMediaFrame>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	:global(.image-placement-card-preview) {
		--circular-media-frame-size: #{$ingredient-food-icon-size};
		--circular-media-frame-background: #{$ingredient-surface-positive};
	}

	:global(.image-placement-card-preview img) {
		display: block;
		width: $ingredient-food-image-content-size;
		height: $ingredient-food-image-content-size;
		object-fit: cover;
		object-position: var(--image-placement-preview-focus-x, 50%)
			var(--image-placement-preview-focus-y, 50%);
		transform: translate(
				var(--image-placement-preview-translate-x, 0%),
				var(--image-placement-preview-translate-y, 0%)
			)
			scale(var(--image-placement-preview-zoom, 1));
		transform-origin: center;
	}
</style>
