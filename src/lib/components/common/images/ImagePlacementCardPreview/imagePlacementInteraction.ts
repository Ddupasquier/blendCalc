import {
	createCustomImagePlacement,
	moveImagePlacement,
	zoomImagePlacement,
} from "$lib/utils/food/images/imagePlacement";
import type {
	ImagePlacementGeometry,
	ImagePlacementValue,
} from "$lib/utils/food/images/types";

type PointerCoordinates = {
	x: number;
	y: number;
};

type DragState = {
	pointerId: number;
	startX: number;
	startY: number;
	value: ImagePlacementValue;
	geometry: ImagePlacementGeometry;
};

type PinchState = {
	startDistance: number;
	startZoom: number;
	value: ImagePlacementValue;
};

type ImagePlacementInteractionOptions = {
	isEnabled: () => boolean;
	getGeometry: () => ImagePlacementGeometry;
	getValue: () => ImagePlacementValue;
	onChange: (value: ImagePlacementValue) => void;
};

export const createImagePlacementInteraction = ({
	isEnabled,
	getGeometry,
	getValue,
	onChange,
}: ImagePlacementInteractionOptions) => {
	const pointers = new Map<number, PointerCoordinates>();
	let dragState: DragState | null = null;
	let pinchState: PinchState | null = null;

	const pointerDistance = () => {
		const activePointers = [...pointers.values()];
		if (activePointers.length < 2) return 0;
		return Math.hypot(
			activePointers[1].x - activePointers[0].x,
			activePointers[1].y - activePointers[0].y,
		);
	};

	const beginDrag = (pointerId: number, x: number, y: number) => {
		const geometry = getGeometry();
		dragState = {
			pointerId,
			startX: x,
			startY: y,
			value: createCustomImagePlacement(getValue(), geometry.effectiveZoom),
			geometry,
		};
		pinchState = null;
	};

	const beginPinch = () => {
		const startDistance = pointerDistance();
		if (!startDistance) return;
		const geometry = getGeometry();
		pinchState = {
			startDistance,
			startZoom: geometry.effectiveZoom,
			value: createCustomImagePlacement(getValue(), geometry.effectiveZoom),
		};
		dragState = null;
	};

	const handlePointerDown = (event: PointerEvent) => {
		if (
			!isEnabled() ||
			!getGeometry().ready ||
			(event.pointerType === "mouse" && event.button !== 0)
		) {
			return;
		}
		event.preventDefault();
		(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
		pointers.set(event.pointerId, {
			x: event.clientX,
			y: event.clientY,
		});
		if (pointers.size === 1) {
			beginDrag(event.pointerId, event.clientX, event.clientY);
		} else {
			beginPinch();
		}
	};

	const handlePointerMove = (event: PointerEvent) => {
		if (!isEnabled() || !pointers.has(event.pointerId)) return;
		event.preventDefault();
		pointers.set(event.pointerId, {
			x: event.clientX,
			y: event.clientY,
		});

		if (pointers.size >= 2) {
			if (!pinchState) beginPinch();
			if (!pinchState) return;
			const distance = pointerDistance();
			const zoom = pinchState.startZoom * (distance / pinchState.startDistance);
			onChange(zoomImagePlacement(pinchState.value, zoom));
			return;
		}

		if (!dragState || dragState.pointerId !== event.pointerId) {
			beginDrag(event.pointerId, event.clientX, event.clientY);
			return;
		}

		onChange(
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
		const target = event.currentTarget as HTMLElement;
		if (target.hasPointerCapture?.(event.pointerId)) {
			target.releasePointerCapture(event.pointerId);
		}
		pinchState = null;
		dragState = null;
		const remainingPointer = [...pointers.entries()][0];
		if (remainingPointer) {
			beginDrag(
				remainingPointer[0],
				remainingPointer[1].x,
				remainingPointer[1].y,
			);
		}
	};

	const handleWheel = (event: WheelEvent) => {
		const geometry = getGeometry();
		if (!isEnabled() || !geometry.ready) return;
		event.preventDefault();
		const zoom = geometry.effectiveZoom * Math.exp(-event.deltaY * 0.002);
		onChange(zoomImagePlacement(getValue(), zoom));
	};

	return {
		finishPointer,
		handlePointerDown,
		handlePointerMove,
		handleWheel,
	};
};
