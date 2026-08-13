import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260812180000_automatic_image_placement.sql",
	"utf8",
);

describe("automatic image placement migration", () => {
	it("records automatic OCR separately from a person accepting a suggestion", () => {
		expect(migration).toContain("'default'");
		expect(migration).toContain("'manual'");
		expect(migration).toContain("'automatic-ocr'");
		expect(migration).toContain("'smart-ocr'");
		expect(migration).toContain("'smart-ocr-adjusted'");
		expect(migration).toContain("placement_method = 'automatic-ocr'");
		expect(migration).toContain("placement_suggestion_accepted_at is not null");
		expect(migration).toContain("remains null for automatic-ocr backfills");
	});
});
