import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scriptUtility = readFileSync(
	"scripts/lib/images/smart_image_placement.mjs",
	"utf8",
);

describe("script smart image placement", () => {
	it("uses the same algorithm version, threshold, and quarter-turn set as the app", () => {
		expect(scriptUtility).toContain('"tesseract-product-label-v2"');
		expect(scriptUtility).toContain("AUTOMATIC_IMAGE_PLACEMENT_MINIMUM_CONFIDENCE = 68");
		expect(scriptUtility).toContain("[0, 90, 270, 180]");
		expect(scriptUtility).toContain("best.winner.productOverlap <= 0");
	});

	it("normalizes encoded orientation and keeps raw OCR text out of persistence", () => {
		expect(scriptUtility).toContain("autoOrient: true");
		expect(scriptUtility).toContain("tessedit_pageseg_mode: PSM.SPARSE_TEXT");
		expect(scriptUtility).toContain("REPRESENTATIVE_CARD_MEDIA_LANE_WIDTH = 96");
		expect(scriptUtility).toContain('resolve("scripts/output/tesseract")');
		expect(scriptUtility).toContain('placement_method: "automatic-ocr"');
		expect(scriptUtility).not.toMatch(/ocr_(?:text|result)/);
	});
});
