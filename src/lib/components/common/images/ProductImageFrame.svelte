<script lang="ts">
	import type { ProductImageFrameProps } from "$lib/components/common/images/types";

	let {
		src,
		alt,
		loading = "lazy",
		onError,
	}: ProductImageFrameProps = $props();
</script>

<figure class="product-image-frame">
	<img
		class="product-image-frame__image"
		{src}
		{alt}
		{loading}
		decoding="async"
		onerror={() => onError?.()}
	/>
</figure>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.product-image-frame {
		display: flex;
		justify-content: center;
		width: 100%;
		margin: 0;
	}

	.product-image-frame__image {
		display: block;
		box-sizing: border-box;
		width: auto;
		max-width: min(100%, $ingredient-product-image-frame-max-width);
		height: auto;
		max-height: $ingredient-product-image-frame-max-height;
		padding: $ingredient-product-image-frame-padding;
		object-fit: contain;
		background: $ingredient-surface-soft;
		border-radius: $ingredient-radius-card;
	}
</style>
