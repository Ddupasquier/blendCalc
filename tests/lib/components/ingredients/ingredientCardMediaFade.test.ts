import { describe, expect, it } from "vitest";

import { getIngredientCardMediaMaskHorizontalRadiusPixels } from "$lib/components/ingredients/card/IngredientCardMediaLane/ingredientCardMediaFade";
import type { ImagePlacementGeometry } from "$lib/utils/food/images/types";

const createGeometry = (
	overrides: Partial<ImagePlacementGeometry> = {},
): ImagePlacementGeometry => ({
	ready: true,
	naturalWidth: 50,
	naturalHeight: 100,
	frameWidth: 100,
	frameHeight: 100,
	baseWidth: 50,
	baseHeight: 100,
	rotationDegrees: 0,
	effectiveZoom: 1,
	coverZoom: 2,
	maxOffsetX: 25,
	maxOffsetY: 0,
	offsetX: -25,
	offsetY: 0,
	canMoveX: true,
	canMoveY: false,
	horizontalMovement: "left-only",
	horizontalOriginOffsetX: -25,
	...overrides,
});

describe("ingredient card media fade", () => {
	it("finishes three pixels before a contained image edge", () => {
		const radius =
			getIngredientCardMediaMaskHorizontalRadiusPixels(createGeometry());

		expect(radius).toBe(58.75);
		expect(radius! * 0.8).toBe(47);
	});

	it("keeps the configured full-lane curve when the image extends beyond it", () => {
		const radius = getIngredientCardMediaMaskHorizontalRadiusPixels(
			createGeometry({
				baseWidth: 160,
				offsetX: 30,
			}),
		);

		expect(radius).toBe(100);
	});

	it("waits for measured image geometry", () => {
		expect(
			getIngredientCardMediaMaskHorizontalRadiusPixels(
				createGeometry({ ready: false }),
			),
		).toBeNull();
	});
});
