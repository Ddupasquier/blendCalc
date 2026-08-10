import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260724143000_food_image_smart_placement.sql",
	"utf8",
);

describe("food image smart placement migration", () => {
	it("stores accepted placement method and bounded suggestion provenance", () => {
		expect(migration).toContain("placement_method text not null default 'default'");
		expect(migration).toContain("placement_suggestion_version text");
		expect(migration).toContain("placement_suggestion_confidence numeric");
		expect(migration).toContain("placement_suggestion_accepted_at timestamptz");
		expect(migration).toContain("'smart-ocr-adjusted'");
		expect(migration).toContain("between 0 and 100");
	});

	it("does not store raw OCR text", () => {
		expect(migration).not.toMatch(/ocr_(?:text|result)/);
		expect(migration).toContain("Raw OCR text is intentionally not stored");
	});
});
