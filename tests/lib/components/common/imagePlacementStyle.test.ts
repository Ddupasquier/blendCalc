import { describe, expect, it } from "vitest";

import {
	getImagePlacementGeometryCssVars,
	getLegacyImagePlacementCssVars,
} from "$lib/components/common/images/imagePlacementStyle";

describe("getLegacyImagePlacementCssVars", () => {
	it("moves horizontally and vertically even without extra zoom", () => {
		const style = getLegacyImagePlacementCssVars(
			{ cropX: 25, cropY: 75, cropZoom: 1 },
			"image-placement",
		);

		expect(style).toContain("--image-placement-translate-x: 25%");
		expect(style).toContain("--image-placement-translate-y: -25%");
		expect(style).toContain("--image-placement-zoom: 1");
	});

	it("keeps centered images still when crop is centered", () => {
		const style = getLegacyImagePlacementCssVars(
			{ cropX: 50, cropY: 50, cropZoom: 4 },
			"food-symbol",
		);

		expect(style).toContain("--food-symbol-translate-x: 0%");
		expect(style).toContain("--food-symbol-translate-y: 0%");
	});
});

describe("getImagePlacementGeometryCssVars", () => {
	it("uses unrotated image dimensions while rendering a rotated visual box", () => {
		const style = getImagePlacementGeometryCssVars({
			ready: true,
			naturalWidth: 200,
			naturalHeight: 100,
			frameWidth: 100,
			frameHeight: 100,
			baseWidth: 50,
			baseHeight: 100,
			rotationDegrees: 90,
			effectiveZoom: 1,
			coverZoom: 2,
			maxOffsetX: 0,
			maxOffsetY: 0,
			offsetX: 0,
			offsetY: 0,
			canMoveX: false,
			canMoveY: false,
			horizontalMovement: "symmetric",
			horizontalOriginOffsetX: 0,
		}, "image-placement");

		expect(style).toContain("--image-placement-image-width: 100px");
		expect(style).toContain("--image-placement-image-height: 50px");
		expect(style).toContain("--image-placement-rotation: 90deg");
	});
});
