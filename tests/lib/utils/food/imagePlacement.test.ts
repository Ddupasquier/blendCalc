import { describe, expect, it } from "vitest";

import {
	createFillImagePlacement,
	createFullImagePlacement,
	getImagePlacementGeometry,
	getStoredImagePlacement,
	moveImagePlacement,
	zoomImagePlacement,
} from "$lib/utils/food/images/imagePlacement";

const squareFrame = {
	frameWidth: 100,
	frameHeight: 100,
};

describe("image placement geometry", () => {
	it("shows the complete image at the version 2 default", () => {
		const geometry = getImagePlacementGeometry({
			...squareFrame,
			naturalWidth: 200,
			naturalHeight: 100,
			value: createFullImagePlacement(),
		});

		expect(geometry.baseWidth).toBe(100);
		expect(geometry.baseHeight).toBe(50);
		expect(geometry.effectiveZoom).toBe(1);
		expect(geometry.canMoveX).toBe(false);
		expect(geometry.canMoveY).toBe(false);
	});

	it("calculates the minimum zoom needed to fill the circle", () => {
		const fullGeometry = getImagePlacementGeometry({
			...squareFrame,
			naturalWidth: 200,
			naturalHeight: 100,
			value: createFullImagePlacement(),
		});
		const fillGeometry = getImagePlacementGeometry({
			...squareFrame,
			naturalWidth: 200,
			naturalHeight: 100,
			value: createFillImagePlacement(fullGeometry.coverZoom),
		});

		expect(fillGeometry.coverZoom).toBe(2);
		expect(fillGeometry.effectiveZoom).toBe(2);
		expect(fillGeometry.canMoveX).toBe(true);
		expect(fillGeometry.canMoveY).toBe(false);
	});

	it("maps 0, 50, and 100 to the full movement range", () => {
		const getOffset = (cropX: number) => getImagePlacementGeometry({
			...squareFrame,
			naturalWidth: 200,
			naturalHeight: 100,
			value: {
				cropX,
				cropY: 50,
				cropZoom: 2,
				fitMode: "custom",
				placementVersion: 2,
			},
		}).offsetX;

		expect(getOffset(0)).toBe(50);
		expect(getOffset(50)).toBe(0);
		expect(getOffset(100)).toBe(-50);
	});

	it("keeps an axis centered when there is no overflow", () => {
		const geometry = getImagePlacementGeometry({
			...squareFrame,
			naturalWidth: 200,
			naturalHeight: 100,
			value: createFillImagePlacement(2),
		});
		const moved = moveImagePlacement({
			value: createFillImagePlacement(2),
			geometry,
			deltaX: 25,
			deltaY: 25,
		});

		expect(moved.cropX).toBe(25);
		expect(moved.cropY).toBe(50);
		expect(moved.fitMode).toBe("custom");
		expect(moved.placementVersion).toBe(2);
		expect(moved.placementMethod).toBe("manual");
	});

	it("turns zoom changes into version 2 custom placement", () => {
		const zoomed = zoomImagePlacement(createFullImagePlacement(), 3);

		expect(zoomed.cropZoom).toBe(3);
		expect(zoomed.fitMode).toBe("custom");
		expect(zoomed.placementVersion).toBe(2);
		expect(zoomed.placementMethod).toBe("manual");
	});

	it("preserves smart provenance when a suggestion is manually adjusted", () => {
		const zoomed = zoomImagePlacement({
			cropX: 70,
			cropY: 40,
			cropZoom: 2,
			fitMode: "custom",
			placementVersion: 2,
			placementMethod: "smart-ocr",
			suggestionVersion: "tesseract-product-label-v1",
			suggestionConfidence: 82,
		}, 2.5);

		expect(zoomed.placementMethod).toBe("smart-ocr-adjusted");
		expect(zoomed.suggestionVersion).toBe("tesseract-product-label-v1");
		expect(zoomed.suggestionConfidence).toBe(82);
	});

	it("keeps rows without version metadata on legacy rendering", () => {
		expect(getStoredImagePlacement({ cropX: 20, cropY: 80, cropZoom: 1.5 })).toEqual({
			cropX: 20,
			cropY: 80,
			cropZoom: 1.5,
			fitMode: "cover",
			placementVersion: 1,
			placementMethod: "manual",
		});
	});
});
