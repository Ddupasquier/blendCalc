import { describe, expect, it } from "vitest";

import {
	constrainCardImagePlacement,
	createFillImagePlacement,
	createFullImagePlacement,
	createDefaultCardImagePlacement,
	getCardImagePlacement,
	getImagePlacementGeometry,
	getStoredImagePlacement,
	moveImagePlacement,
	normalizeImageRotationDegrees,
	rotateImagePlacement,
	zoomImagePlacement,
} from "$lib/utils/food/images/imagePlacement";

const squareFrame = {
	frameWidth: 100,
	frameHeight: 100,
};

describe("image placement geometry", () => {
	it("shows the complete image with the explicit version 2 Full image preset", () => {
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

	it("swaps the rendered geometry for quarter-turn rotations", () => {
		const geometry = getImagePlacementGeometry({
			...squareFrame,
			naturalWidth: 200,
			naturalHeight: 100,
			value: {
				...createFullImagePlacement(),
				rotationDegrees: 90,
			},
		});

		expect(geometry.baseWidth).toBe(50);
		expect(geometry.baseHeight).toBe(100);
		expect(geometry.rotationDegrees).toBe(90);
		expect(geometry.coverZoom).toBe(2);
	});

	it("maps 0, 50, and 100 to the full movement range", () => {
		const getOffset = (cropX: number) =>
			getImagePlacementGeometry({
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

	it("keeps card images flush left and only permits shifting them farther left", () => {
		const getGeometry = (cropX: number) =>
			getImagePlacementGeometry({
				...squareFrame,
				naturalWidth: 50,
				naturalHeight: 100,
				horizontalMovement: "left-only",
				value: {
					...createFullImagePlacement(),
					cropX,
				},
			});

		const flushGeometry = getGeometry(50);
		const shiftedGeometry = getGeometry(100);
		const disallowedRightGeometry = getGeometry(0);

		expect(flushGeometry.canMoveX).toBe(true);
		expect(flushGeometry.offsetX).toBe(-25);
		expect(shiftedGeometry.offsetX).toBe(-50);
		expect(disallowedRightGeometry.offsetX).toBe(flushGeometry.offsetX);
	});

	it("maps card dragging to left-only movement and allows returning to the edge", () => {
		const geometry = getImagePlacementGeometry({
			...squareFrame,
			naturalWidth: 50,
			naturalHeight: 100,
			horizontalMovement: "left-only",
			value: createFullImagePlacement(),
		});
		const shifted = moveImagePlacement({
			value: createFullImagePlacement(),
			geometry,
			deltaX: -12.5,
			deltaY: 0,
		});
		const returned = moveImagePlacement({
			value: shifted,
			geometry,
			deltaX: 25,
			deltaY: 0,
		});

		expect(shifted.cropX).toBe(75);
		expect(returned.cropX).toBe(50);
	});

	it("constrains persisted card placement to the left-only range", () => {
		expect(
			constrainCardImagePlacement({
				...createFullImagePlacement(),
				cropX: 10,
			}).cropX,
		).toBe(50);
		expect(
			constrainCardImagePlacement({
				...createFullImagePlacement(),
				cropX: 80,
			}).cropX,
		).toBe(80);
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
		const zoomed = zoomImagePlacement(
			{
				cropX: 70,
				cropY: 40,
				cropZoom: 2,
				rotationDegrees: 0,
				fitMode: "custom",
				placementVersion: 2,
				placementMethod: "smart-ocr",
				suggestionVersion: "tesseract-product-label-v1",
				suggestionConfidence: 82,
			},
			2.5,
		);

		expect(zoomed.placementMethod).toBe("smart-ocr-adjusted");
		expect(zoomed.suggestionVersion).toBe("tesseract-product-label-v1");
		expect(zoomed.suggestionConfidence).toBe(82);
	});

	it("turns an automatic OCR placement into an adjusted smart placement", () => {
		const adjusted = zoomImagePlacement(
			{
				cropX: 65,
				cropY: 45,
				cropZoom: 2,
				rotationDegrees: 90,
				fitMode: "custom",
				placementVersion: 2,
				placementMethod: "automatic-ocr",
				suggestionVersion: "tesseract-product-label-v2",
				suggestionConfidence: 79,
			},
			2.25,
		);

		expect(adjusted.placementMethod).toBe("smart-ocr-adjusted");
		expect(adjusted.suggestionVersion).toBe("tesseract-product-label-v2");
		expect(adjusted.suggestionConfidence).toBe(79);
	});

	it("rotates clockwise in supported quarter turns", () => {
		const firstTurn = rotateImagePlacement(createFullImagePlacement());
		const secondTurn = rotateImagePlacement(firstTurn);
		const thirdTurn = rotateImagePlacement(secondTurn);
		const fourthTurn = rotateImagePlacement(thirdTurn);

		expect(firstTurn.rotationDegrees).toBe(90);
		expect(secondTurn.rotationDegrees).toBe(180);
		expect(thirdTurn.rotationDegrees).toBe(270);
		expect(fourthTurn.rotationDegrees).toBe(0);
		expect(firstTurn.placementMethod).toBe("manual");
	});

	it("normalizes arbitrary rotation values to the closest quarter turn", () => {
		expect(normalizeImageRotationDegrees(44)).toBe(0);
		expect(normalizeImageRotationDegrees(46)).toBe(90);
		expect(normalizeImageRotationDegrees(-90)).toBe(270);
	});

	it("keeps rows without version metadata on legacy rendering", () => {
		expect(
			getStoredImagePlacement({ cropX: 20, cropY: 80, cropZoom: 1.5 }),
		).toEqual({
			cropX: 20,
			cropY: 80,
			cropZoom: 1.5,
			rotationDegrees: 0,
			fitMode: "cover",
			placementVersion: 1,
			placementMethod: "manual",
		});
	});
});

describe("otherwise-unplaced card fallback", () => {
	it("preserves the existing manual zoom bound while an unplaced source fills the lane", () => {
		const frame = {
			naturalWidth: 40,
			naturalHeight: 200,
			frameWidth: 160,
			frameHeight: 75,
		};
		expect(
			getImagePlacementGeometry({
				...frame,
				value: createFillImagePlacement(12),
			}).effectiveZoom,
		).toBe(8);
		expect(
			getImagePlacementGeometry({
				...frame,
				value: createDefaultCardImagePlacement(),
			}).effectiveZoom,
		).toBeGreaterThan(8);
	});
	it.each([undefined, null, {}])(
		"uses Fill card when no geometry was stored",
		(value) => {
			expect(getCardImagePlacement(value)).toEqual(
				createDefaultCardImagePlacement(),
			);
		},
	);

	it("fills explicitly untouched defaults without modifying the source object", () => {
		const source = Object.freeze(createFullImagePlacement());
		expect(getCardImagePlacement(source).fitMode).toBe("cover");
		expect(source.fitMode).toBe("contain");
	});

	it.each([
		"manual",
		"automatic-ocr",
		"smart-ocr",
		"smart-ocr-adjusted",
	] as const)(
		"preserves %s placements, including their metadata",
		(placementMethod) => {
			const source = {
				...createFullImagePlacement(),
				placementMethod,
				cropX: 63,
				cropY: 21,
				cropZoom: 2.6,
				rotationDegrees: 90 as const,
				suggestionVersion: "reviewed-v2",
				suggestionConfidence: 78,
			};
			expect(getCardImagePlacement(source)).toEqual(
				getStoredImagePlacement(source),
			);
		},
	);

	it.each([
		{ cropSource: "user" as const },
		{ cropSource: "moderator" as const },
		{ approvedBy: "synthetic-reviewer" },
		{ approvedAt: "2026-09-01T00:00:00Z" },
		{ suggestionAcceptedAt: "2026-09-01T00:00:00Z" },
	])(
		"respects authoritative provenance on an otherwise default shape",
		(provenance) => {
			const source = { ...createFullImagePlacement(), ...provenance };
			expect(getCardImagePlacement(source).fitMode).toBe("contain");
		},
	);

	it("does not reclassify unknown legacy geometry or adjusted default rows", () => {
		const legacy = { cropX: 20, cropY: 80, cropZoom: 1.5 };
		expect(getCardImagePlacement(legacy)).toEqual(
			getStoredImagePlacement(legacy),
		);
		const adjusted = { ...createFullImagePlacement(), cropX: 61 };
		expect(getCardImagePlacement(adjusted)).toEqual(
			getStoredImagePlacement(adjusted),
		);
		const unknown = {
			...createFullImagePlacement(),
			placementMethod: undefined,
		};
		expect(getCardImagePlacement(unknown).fitMode).toBe("contain");
	});

	it.each([
		[40, 200],
		[200, 40],
		[1000, 1000],
	])(
		"covers the measured lane without stretching a %i×%i source",
		(naturalWidth, naturalHeight) => {
			const geometry = getImagePlacementGeometry({
				naturalWidth,
				naturalHeight,
				frameWidth: 160,
				frameHeight: 75,
				value: createDefaultCardImagePlacement(),
			});
			expect(geometry.ready).toBe(true);
			expect(
				geometry.baseWidth * geometry.effectiveZoom,
			).toBeGreaterThanOrEqual(160 - 0.001);
			expect(
				geometry.baseHeight * geometry.effectiveZoom,
			).toBeGreaterThanOrEqual(75 - 0.001);
			expect(geometry.baseWidth / geometry.baseHeight).toBeCloseTo(
				naturalWidth / naturalHeight,
			);
		},
	);
});
