import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const backfill = readFileSync(
	"scripts/backfills/images/backfill_food_image_placements.mjs",
	"utf8",
);

describe("food image placement backfill", () => {
	it("only targets active untouched default and legacy imported placements", () => {
		expect(backfill).toContain('.eq("status", "active")');
		expect(backfill).toContain('.eq("image_role", "front")');
		expect(backfill).toContain('image.placement_method === "default"');
		expect(backfill).toContain('image.placement_method === "manual"');
		expect(backfill).toContain('image.placement_version === 1');
		expect(backfill).toContain('image.crop_source === "auto"');
		expect(backfill).toContain('.eq("rotation_degrees", 0)');
		expect(backfill).toContain('.is("approved_by", null)');
		expect(backfill).toContain(".update(placement)");
		expect(backfill).toContain("createFullImagePlacementUpgrade");
		expect(backfill).toContain('placement_method: "default"');
	});

	it("runs as a dry-run by default in documented usage and records no OCR text", () => {
		expect(backfill).toContain("--dry-run");
		expect(backfill).toContain("getOpenFoodFactsFullImageUrl");
		expect(backfill).toContain('".full.jpg"');
		expect(backfill).toContain("placement_suggestion_confidence");
		expect(backfill).not.toMatch(/ocr_(?:text|result)/);
	});
});
