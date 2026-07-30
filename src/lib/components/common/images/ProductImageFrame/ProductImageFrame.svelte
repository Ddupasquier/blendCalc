<script lang="ts">
	import ImagePlacementViewport from "$lib/components/common/images/ImagePlacementViewport/ImagePlacementViewport.svelte";
	import { observeImageEvents } from "$lib/utils/dom/imageEvents";
	import {
		createFullImagePlacement,
		normalizeImageRotationDegrees,
	} from "$lib/utils/food/images/imagePlacement";
	import type { ProductImageFrameProps } from "./types";

	let {
		src,
		alt,
		loading = "lazy",
		rotationDegrees = 0,
		onError,
	}: ProductImageFrameProps = $props();

	let imageElement = $state<HTMLImageElement | null>(null);
	const normalizedRotation = $derived(
		normalizeImageRotationDegrees(rotationDegrees),
	);
	const rotatedPlacement = $derived(
		createFullImagePlacement(normalizedRotation),
	);

	$effect(() => {
		if (normalizedRotation !== 0) return;
		src;
		const image = imageElement;
		if (!image) return;
		return observeImageEvents(image, { onError });
	});
</script>

<figure class="product-image-frame">
	{#if normalizedRotation === 0}
		<img
			bind:this={imageElement}
			class="product-image-frame__image"
			{src}
			{alt}
			{loading}
			decoding="async"
		/>
	{:else}
		<span
			class="product-image-frame__rotated-image"
			data-rotation-degrees={normalizedRotation}
		>
			<ImagePlacementViewport
				imageUrl={src}
				{alt}
				value={rotatedPlacement}
				{loading}
				{onError}
			/>
		</span>
	{/if}
</figure>

<style lang="scss">
	@use "./ProductImageFrame.scss";
</style>
