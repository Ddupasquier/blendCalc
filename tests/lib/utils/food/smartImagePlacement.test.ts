import { describe, expect, it } from "vitest";

import { getImagePlacementGeometry } from "$lib/utils/food/images/imagePlacement";
import {
	AUTOMATIC_IMAGE_PLACEMENT_MINIMUM_CONFIDENCE,
	SMART_IMAGE_PLACEMENT_VERSION,
	isConfidentAutomaticImagePlacementSuggestion,
	selectBestImagePlacementSuggestion,
	suggestImagePlacementFromText,
} from "$lib/utils/food/images/smartImagePlacement";

const geometry = getImagePlacementGeometry({
	naturalWidth: 1000,
	naturalHeight: 1600,
	frameWidth: 80,
	frameHeight: 68,
	horizontalMovement: "left-only",
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

	it("tolerates a small OCR error when a low-resolution package still identifies the product", () => {
		const suggestion = suggestImagePlacementFromText({
			document: {
				width: 904,
				height: 1600,
				regions: [{
					text: "LEANUT BUTT from unblanched peanuts",
					confidence: 43,
					bounds: { x0: 80, y0: 180, x1: 830, y1: 1420 },
				}],
			},
			geometry,
			productName: "Peanut Butter",
		});

		expect(suggestion).not.toBeNull();
		expect(suggestion?.productTokenOverlap).toBe(0.5);
		expect(isConfidentAutomaticImagePlacementSuggestion(suggestion)).toBe(true);
		expect(suggestion?.placement.fitMode).toBe("custom");
	});

	it("chooses the quarter-turn orientation with the strongest product match", () => {
		const suggestion = selectBestImagePlacementSuggestion({
			documents: [
				{
					width: 1000,
					height: 1600,
					rotationDegrees: 0,
					regions: [{
						text: "Nutrition Facts Calories 200",
						confidence: 92,
						bounds: { x0: 80, y0: 80, x1: 900, y1: 500 },
					}],
				},
				{
					width: 1600,
					height: 1000,
					rotationDegrees: 90,
					regions: [{
						text: "Sempio Gochu Jang",
						confidence: 94,
						bounds: { x0: 540, y0: 380, x1: 1080, y1: 580 },
					}],
				},
			],
			geometry,
			productName: "Sempio Gochu Jang",
			brandName: "Sempio",
		});

		expect(suggestion?.placement.rotationDegrees).toBe(90);
		expect(suggestion?.placement.suggestionVersion).toBe(
			SMART_IMAGE_PLACEMENT_VERSION,
		);
		expect(isConfidentAutomaticImagePlacementSuggestion(suggestion)).toBe(true);
	});

	it("keeps low-confidence text as an optional result rather than an automatic draft", () => {
		const suggestion = {
			placement: {
				cropX: 50,
				cropY: 50,
				cropZoom: 1,
				rotationDegrees: 0 as const,
				fitMode: "custom" as const,
				placementVersion: 2,
			},
			confidence: AUTOMATIC_IMAGE_PLACEMENT_MINIMUM_CONFIDENCE - 1,
			matchedText: "Possible label",
			productTokenOverlap: 0.5,
			brandTokenOverlap: 0,
		};

		expect(isConfidentAutomaticImagePlacementSuggestion(suggestion)).toBe(false);
	});

	it("does not automatically apply a brand-only match", () => {
		expect(isConfidentAutomaticImagePlacementSuggestion({
			placement: {
				cropX: 50,
				cropY: 50,
				cropZoom: 2,
				rotationDegrees: 0,
				fitMode: "custom",
				placementVersion: 2,
			},
			confidence: 92,
			matchedText: "Brand name",
			productTokenOverlap: 0,
			brandTokenOverlap: 1,
		})).toBe(false);
	});
});
