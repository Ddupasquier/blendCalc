import { beforeEach, describe, expect, it, vi } from "vitest";

import { createImagePlacementInteraction } from "$lib/components/common/images/ImagePlacementCardPreview/imagePlacementInteraction";
import type { ImagePlacementGeometry } from "$lib/utils/food/images/types";

const geometry: ImagePlacementGeometry = {
	ready: true,
	naturalWidth: 600,
	naturalHeight: 800,
	frameWidth: 120,
	frameHeight: 84,
	baseWidth: 63,
	baseHeight: 84,
	rotationDegrees: 0 as const,
	effectiveZoom: 1,
	coverZoom: 1.9048,
	maxOffsetX: 31.5,
	maxOffsetY: 0,
	offsetX: -28.35,
	offsetY: 0,
	canMoveX: true,
	canMoveY: false,
	horizontalMovement: "left-only",
	horizontalOriginOffsetX: -28.5,
};

const value = {
	cropX: 50,
	cropY: 50,
	cropZoom: 1,
	rotationDegrees: 0 as const,
	fitMode: "contain" as const,
	placementVersion: 2,
};

const pointerTarget = {
	setPointerCapture: vi.fn(),
	hasPointerCapture: vi.fn(() => true),
	releasePointerCapture: vi.fn(),
} as unknown as HTMLElement;

const createPointerEvent = ({
	clientX,
	clientY,
	pointerId = 1,
	pointerType = "mouse",
}: {
	clientX: number;
	clientY: number;
	pointerId?: number;
	pointerType?: string;
}) =>
	({
		button: 0,
		clientX,
		clientY,
		currentTarget: pointerTarget,
		pointerId,
		pointerType,
		preventDefault: vi.fn(),
	}) as unknown as PointerEvent;

const createWheelEvent = ({
	ctrlKey = false,
	metaKey = false,
}: {
	ctrlKey?: boolean;
	metaKey?: boolean;
} = {}) =>
	({
		ctrlKey,
		deltaY: -100,
		metaKey,
		preventDefault: vi.fn(),
	}) as unknown as WheelEvent;

describe("image placement interaction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("starts a drag anywhere on the host preview instead of requiring the media lane", () => {
		const onChange = vi.fn();
		const interaction = createImagePlacementInteraction({
			isEnabled: () => true,
			getGeometry: () => geometry,
			getValue: () => value,
			onChange,
		});
		const pointerDown = createPointerEvent({
			clientX: 280,
			clientY: 40,
		});
		const pointerMove = createPointerEvent({
			clientX: 250,
			clientY: 40,
		});

		interaction.handlePointerDown(pointerDown);
		interaction.handlePointerMove(pointerMove);

		expect(pointerDown.preventDefault).toHaveBeenCalledOnce();
		expect(pointerMove.preventDefault).toHaveBeenCalledOnce();
		expect(onChange).toHaveBeenCalledOnce();
		expect(onChange.mock.calls[0][0].cropX).toBeGreaterThan(50);
	});

	it("leaves vertical touch gestures available to the owning scroll surface", () => {
		const onChange = vi.fn();
		const interaction = createImagePlacementInteraction({
			isEnabled: () => true,
			getGeometry: () => geometry,
			getValue: () => value,
			onChange,
		});
		const pointerDown = createPointerEvent({
			clientX: 100,
			clientY: 100,
			pointerType: "touch",
		});
		const pointerMove = createPointerEvent({
			clientX: 102,
			clientY: 124,
			pointerType: "touch",
		});

		interaction.handlePointerDown(pointerDown);
		interaction.handlePointerMove(pointerMove);

		expect(pointerDown.preventDefault).not.toHaveBeenCalled();
		expect(pointerMove.preventDefault).not.toHaveBeenCalled();
		expect(pointerTarget.setPointerCapture).not.toHaveBeenCalled();
		expect(onChange).not.toHaveBeenCalled();
	});

	it("starts image movement only after a deliberate horizontal touch drag", () => {
		const onChange = vi.fn();
		const interaction = createImagePlacementInteraction({
			isEnabled: () => true,
			getGeometry: () => geometry,
			getValue: () => value,
			onChange,
		});
		const pointerDown = createPointerEvent({
			clientX: 100,
			clientY: 100,
			pointerType: "touch",
		});
		const pointerMove = createPointerEvent({
			clientX: 76,
			clientY: 102,
			pointerType: "touch",
		});

		interaction.handlePointerDown(pointerDown);
		interaction.handlePointerMove(pointerMove);

		expect(pointerDown.preventDefault).not.toHaveBeenCalled();
		expect(pointerMove.preventDefault).toHaveBeenCalledOnce();
		expect(pointerTarget.setPointerCapture).toHaveBeenCalledWith(1);
		expect(onChange).toHaveBeenCalledOnce();
	});

	it("keeps ordinary wheel scrolling available and reserves wheel zoom for pinch modifiers", () => {
		const onChange = vi.fn();
		const interaction = createImagePlacementInteraction({
			isEnabled: () => true,
			getGeometry: () => geometry,
			getValue: () => value,
			onChange,
		});
		const scrollWheel = createWheelEvent();
		const pinchWheel = createWheelEvent({ ctrlKey: true });

		interaction.handleWheel(scrollWheel);
		expect(scrollWheel.preventDefault).not.toHaveBeenCalled();
		expect(onChange).not.toHaveBeenCalled();

		interaction.handleWheel(pinchWheel);
		expect(pinchWheel.preventDefault).toHaveBeenCalledOnce();
		expect(onChange).toHaveBeenCalledOnce();
	});
});
