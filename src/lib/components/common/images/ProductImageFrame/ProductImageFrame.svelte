<script lang="ts">
	import { observeImageEvents } from "$lib/utils/dom/imageEvents";
	import type { ProductImageFrameProps } from "./types";

	let {
		src,
		alt,
		loading = "lazy",
		onError,
	}: ProductImageFrameProps = $props();

	let imageElement = $state<HTMLImageElement | null>(null);

	$effect(() => {
		src;
		const image = imageElement;
		if (!image) return;
		return observeImageEvents(image, { onError });
	});
</script>

<figure class="product-image-frame">
	<img
		bind:this={imageElement}
		class="product-image-frame__image"
		{src}
		{alt}
		{loading}
		decoding="async"
	/>
</figure>

<style lang="scss">
	@use "./ProductImageFrame.scss";
</style>
