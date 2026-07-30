<script lang="ts">
	import {
		getImagePlacementGeometryCssVars,
		getLegacyImagePlacementCssVars,
	} from "$lib/components/common/images/imagePlacementStyle";
	import type { ImagePlacementViewportProps } from "./types";
	import {
		createCustomImagePlacement,
		getImagePlacementGeometry,
	} from "$lib/utils/food/images/imagePlacement";
	import { observeImageEvents } from "$lib/utils/dom/imageEvents";

	let {
		imageUrl,
		alt,
		value,
		horizontalMovement = "symmetric",
		loading = "lazy",
		onGeometryChange,
		onError,
	}: ImagePlacementViewportProps = $props();

	let frameElement = $state<HTMLSpanElement | null>(null);
	let imageElement = $state<HTMLImageElement | null>(null);
	let frameWidth = $state(0);
	let frameHeight = $state(0);
	let naturalWidth = $state(0);
	let naturalHeight = $state(0);
	let lastGeometrySignature = "";

	const editableValue = $derived(
		createCustomImagePlacement(value, value.cropZoom),
	);
	const geometry = $derived(
		getImagePlacementGeometry({
			naturalWidth,
			naturalHeight,
			frameWidth,
			frameHeight,
			horizontalMovement,
			value: value.placementVersion <= 1 ? editableValue : value,
		}),
	);
	const legacyStyle = $derived(
		getLegacyImagePlacementCssVars(value, "image-placement-viewport"),
	);
	const geometryStyle = $derived(
		getImagePlacementGeometryCssVars(geometry, "image-placement-viewport"),
	);
	const syncFrameSize = () => {
		if (!frameElement) return;
		const bounds = frameElement.getBoundingClientRect();
		frameWidth = bounds.width;
		frameHeight = bounds.height;
	};

	const syncImageSize = () => {
		if (!imageElement) return;
		naturalWidth = imageElement.naturalWidth;
		naturalHeight = imageElement.naturalHeight;
	};

	$effect(() => {
		const frame = frameElement;
		if (!frame) return;
		syncFrameSize();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(syncFrameSize);
		observer.observe(frame);
		return () => observer.disconnect();
	});

	$effect(() => {
		imageUrl;
		const image = imageElement;
		if (!image) return;
		return observeImageEvents(image, {
			onLoad: syncImageSize,
			onError,
		});
	});

	$effect(() => {
		const signature = JSON.stringify(geometry);
		if (signature === lastGeometrySignature) return;
		lastGeometrySignature = signature;
		onGeometryChange?.(geometry);
	});

</script>

<span
	bind:this={frameElement}
	class="image-placement-viewport"
>
	<img
		bind:this={imageElement}
		class:image-placement-viewport__image--legacy={value.placementVersion <= 1}
		class:image-placement-viewport__image--current={value.placementVersion > 1}
		src={imageUrl}
		{alt}
		style={value.placementVersion <= 1 ? legacyStyle : geometryStyle}
		draggable="false"
		{loading}
		decoding="async"
	/>
</span>

<style lang="scss">
	@use "./ImagePlacementViewport.scss";
</style>
