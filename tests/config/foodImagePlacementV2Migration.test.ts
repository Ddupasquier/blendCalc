import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260718190000_food_image_placement_v2.sql",
	"utf8",
);

describe("food image placement version 2 migration", () => {
	it("preserves existing placements before changing new-row defaults", () => {
		expect(migration).toContain("fit_mode = coalesce(fit_mode, 'cover')");
		expect(migration).toContain("placement_version = coalesce(placement_version, 1)");
		expect(migration).toContain("alter column fit_mode set default 'contain'");
		expect(migration).toContain("alter column placement_version set default 2");
	});

	it("allows the shared presets and expanded full-image-relative zoom", () => {
		expect(migration).toContain("fit_mode in ('contain', 'cover', 'custom')");
		expect(migration).toContain("crop_zoom >= 1 and crop_zoom <= 8");
		expect(migration).toContain("placement_version >= 1");
	});
});
