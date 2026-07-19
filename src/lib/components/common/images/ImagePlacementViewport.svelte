<script lang="ts">
	import {
		getImagePlacementGeometryCssVars,
		getLegacyImagePlacementCssVars,
	} from "$lib/components/common/images/imagePlacementStyle";
	import type {
		ImagePlacementDragState,
		ImagePlacementPinchState,
		ImagePlacementViewportProps,
	} from "$lib/components/common/images/types";
	import {
		createCustomImagePlacement,
		getImagePlacementGeometry,
		moveImagePlacement,
		zoomImagePlacement,
	} from "$lib/utils/food/images/imagePlacement";

	let {
		imageUrl,
		alt,
		value,
		interactive = false,
		instructionsId = undefined,
		onChange,
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
	const pointers = new Map<number, { x: number; y: number }>();
	let dragState: ImagePlacementDragState | null = null;
	let pinchState: ImagePlacementPinchState | null = null;

	const editableValue = $derived(
		createCustomImagePlacement(value, value.cropZoom),
	);
	const geometry = $derived(
		getImagePlacementGeometry({
			naturalWidth,
			naturalHeight,
			frameWidth,
			frameHeight,
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
		if (imageElement?.complete) syncImageSize();
	});

	$effect(() => {
		const signature = JSON.stringify(geometry);
		if (signature === lastGeometrySignature) return;
		lastGeometrySignature = signature;
		onGeometryChange?.(geometry);
	});

	const pointerDistance = () => {
		const active = [...pointers.values()];
		if (active.length < 2) return 0;
		return Math.hypot(active[1].x - active[0].x, active[1].y - active[0].y);
	};

	const beginDrag = (pointerId: number, x: number, y: number) => {
		dragState = {
			pointerId,
			startX: x,
			startY: y,
			value: createCustomImagePlacement(value, geometry.effectiveZoom),
			geometry,
		};
		pinchState = null;
	};

	const beginPinch = () => {
		const startDistance = pointerDistance();
		if (!startDistance) return;
		pinchState = {
			startDistance,
			startZoom: geometry.effectiveZoom,
			value: createCustomImagePlacement(value, geometry.effectiveZoom),
		};
		dragState = null;
	};

	const handlePointerDown = (event: PointerEvent) => {
		if (!interactive || (event.pointerType === "mouse" && event.button !== 0)) return;
		event.preventDefault();
		(event.currentTarget as HTMLSpanElement).setPointerCapture?.(event.pointerId);
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (pointers.size === 1) {
			beginDrag(event.pointerId, event.clientX, event.clientY);
		} else {
			beginPinch();
		}
	};

	const handlePointerMove = (event: PointerEvent) => {
		if (!interactive || !pointers.has(event.pointerId)) return;
		event.preventDefault();
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

		if (pointers.size >= 2) {
			if (!pinchState) beginPinch();
			if (!pinchState) return;
			const distance = pointerDistance();
			const zoom = pinchState.startZoom * (distance / pinchState.startDistance);
			onChange?.(zoomImagePlacement(pinchState.value, zoom));
			return;
		}

		if (!dragState || dragState.pointerId !== event.pointerId) {
			beginDrag(event.pointerId, event.clientX, event.clientY);
			return;
		}

		onChange?.(
			moveImagePlacement({
				value: dragState.value,
				geometry: dragState.geometry,
				deltaX: event.clientX - dragState.startX,
				deltaY: event.clientY - dragState.startY,
			}),
		);
	};

	const finishPointer = (event: PointerEvent) => {
		if (!pointers.has(event.pointerId)) return;
		pointers.delete(event.pointerId);
		const target = event.currentTarget as HTMLSpanElement;
		if (target.hasPointerCapture?.(event.pointerId)) {
			target.releasePointerCapture(event.pointerId);
		}
		pinchState = null;
		dragState = null;
		const remaining = [...pointers.entries()][0];
		if (remaining) {
			beginDrag(remaining[0], remaining[1].x, remaining[1].y);
		}
	};

	const handleWheel = (event: WheelEvent) => {
		if (!interactive || !geometry.ready) return;
		event.preventDefault();
		const zoom = geometry.effectiveZoom * Math.exp(-event.deltaY * 0.002);
		onChange?.(zoomImagePlacement(value, zoom));
	};
</script>

<span
	bind:this={frameElement}
	class="image-placement-viewport"
	class:image-placement-viewport--interactive={interactive}
	role={interactive ? "group" : undefined}
	aria-label={interactive ? "Drag product image to reposition it" : undefined}
	aria-describedby={interactive ? instructionsId : undefined}
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={finishPointer}
	onpointercancel={finishPointer}
	onlostpointercapture={finishPointer}
	onwheel={handleWheel}
>
	<img
		bind:this={imageElement}
		class:image-placement-viewport__image--legacy={value.placementVersion <= 1}
		class:image-placement-viewport__image--current={value.placementVersion > 1}
		src={imageUrl}
		{alt}
		style={value.placementVersion <= 1 ? legacyStyle : geometryStyle}
		draggable="false"
		loading="lazy"
		decoding="async"
		onload={syncImageSize}
		onerror={onError}
	/>
</span>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.image-placement-viewport {
		position: relative;
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.image-placement-viewport--interactive {
		cursor: grab;
		touch-action: none;
	}

	.image-placement-viewport--interactive:active {
		cursor: grabbing;
	}

	.image-placement-viewport img {
		display: block;
		max-width: none;
		max-height: none;
		pointer-events: none;
		user-select: none;
		image-orientation: from-image;
		-webkit-user-drag: none;
	}

	.image-placement-viewport__image--legacy {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: var(--image-placement-viewport-focus-x, 50%)
			var(--image-placement-viewport-focus-y, 50%);
		transform: translate(
				var(--image-placement-viewport-translate-x, 0%),
				var(--image-placement-viewport-translate-y, 0%)
			)
			scale(var(--image-placement-viewport-zoom, 1));
		transform-origin: center;
	}

	.image-placement-viewport__image--current {
		position: absolute;
		left: calc(50% + var(--image-placement-viewport-offset-x, 0px));
		top: calc(50% + var(--image-placement-viewport-offset-y, 0px));
		width: var(--image-placement-viewport-base-width, 100%);
		height: var(--image-placement-viewport-base-height, 100%);
		object-fit: fill;
		transform: translate(-50%, -50%)
			scale(var(--image-placement-viewport-zoom, 1));
		transform-origin: center;
	}
</style>
