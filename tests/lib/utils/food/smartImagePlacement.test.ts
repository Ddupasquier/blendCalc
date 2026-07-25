import { describe, expect, it } from "vitest";

import { getImagePlacementGeometry } from "$lib/utils/food/images/imagePlacement";
import {
	SMART_IMAGE_PLACEMENT_VERSION,
	suggestImagePlacementFromText,
} from "$lib/utils/food/images/smartImagePlacement";

const geometry = getImagePlacementGeometry({
	naturalWidth: 1000,
	naturalHeight: 1600,
	frameWidth: 80,
	frameHeight: 68,
	value: {
		cropX: 50,
		cropY: 50,
		cropZoom: 1,
		fitMode: "contain",
		placementVersion: 2,
	},
});

describe("smart image placement", () => {
	it("prioritizes matching front-label text over nutrition details", () => {
		const suggestion = suggestImagePlacementFromText({
			document: {
				width: 1000,
				height: 1600,
				regions: [
					{
						text: "Nutrition Facts Calories 200 Sodium 15mg",
						confidence: 96,
						bounds: { x0: 80, y0: 80, x1: 900, y1: 500 },
					},
					{
						text: "Sempio",
						confidence: 92,
						bounds: { x0: 580, y0: 760, x1: 850, y1: 850 },
					},
					{
						text: "Gochu Jang Hot & Sweet Chili Sauce",
						confidence: 89,
						bounds: { x0: 500, y0: 860, x1: 920, y1: 1040 },
					},
				],
			},
			geometry,
			productName: "Sempio, Gochu Jang Hot & Sweet Chili Sauce",
			brandName: "Sempio",
		});

		expect(suggestion).not.toBeNull();
		expect(suggestion?.matchedText).toMatch(/Sempio|Gochu Jang/);
		expect(suggestion?.placement.cropX).toBeGreaterThan(50);
		expect(suggestion?.placement.fitMode).toBe("custom");
		expect(suggestion?.placement.placementMethod).toBe("smart-ocr");
		expect(suggestion?.placement.suggestionVersion).toBe(
			SMART_IMAGE_PLACEMENT_VERSION,
		);
		expect(suggestion?.placement.suggestionConfidence).toBeGreaterThan(60);
	});

	it("returns no suggestion when OCR finds no useful label text", () => {
		const suggestion = suggestImagePlacementFromText({
			document: {
				width: 1000,
				height: 1600,
				regions: [{
					text: "Nutrition Facts Calories 200 Sodium 15mg",
					confidence: 96,
					bounds: { x0: 80, y0: 80, x1: 900, y1: 500 },
				}],
			},
			geometry,
			productName: "Different Product",
		});

		expect(suggestion).toBeNull();
	});
});
