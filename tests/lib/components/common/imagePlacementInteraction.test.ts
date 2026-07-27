import { describe, expect, it, vi } from "vitest";

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
}: {
	clientX: number;
	clientY: number;
	pointerId?: number;
}) =>
	({
		button: 0,
		clientX,
		clientY,
		currentTarget: pointerTarget,
		pointerId,
		pointerType: "mouse",
		preventDefault: vi.fn(),
	}) as unknown as PointerEvent;

describe("image placement interaction", () => {
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
});
