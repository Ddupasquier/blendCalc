<script lang="ts">
	import type { ProductImageFrameProps } from "./types";

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
	@use "./ProductImageFrame.scss";
</style>
