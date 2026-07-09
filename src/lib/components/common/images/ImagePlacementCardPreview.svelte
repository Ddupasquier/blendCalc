<script lang="ts">
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

<div class="image-placement-card-preview" aria-label={ariaLabel}>
	<img src={imageUrl} {alt} style={imageStyle} />
</div>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.image-placement-card-preview {
		display: inline-grid;
		place-items: center;
		width: $ingredient-food-icon-size;
		height: $ingredient-food-icon-size;
		overflow: hidden;
		background: $ingredient-surface-positive;
		border-radius: $ingredient-radius-pill;
	}

	.image-placement-card-preview img {
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
