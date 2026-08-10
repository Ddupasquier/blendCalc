import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260708190000_food_image_asset_crop_and_public_storage.sql",
	"utf8",
);

describe("food image asset crop and public storage migration", () => {
	it("adds reusable crop and approval metadata to food images", () => {
		expect(migration).toContain("add column if not exists crop_x numeric");
		expect(migration).toContain("add column if not exists crop_y numeric");
		expect(migration).toContain("add column if not exists crop_zoom numeric");
		expect(migration).toContain("add column if not exists crop_source text");
		expect(migration).toContain("approved_by uuid references auth.users");
		expect(migration).toContain("approved_at timestamptz");
	});

	it("creates a public approved image bucket separate from private evidence", () => {
		expect(migration).toContain("'food-image-assets'");
		expect(migration).toContain("true");
		expect(migration).toContain("Anyone can read public food images");
		expect(migration).not.toContain("product-submission-evidence");
	});

	it("keeps crop values bounded for predictable card rendering", () => {
		expect(migration).toContain("crop_x >= 0 and crop_x <= 100");
		expect(migration).toContain("crop_y >= 0 and crop_y <= 100");
		expect(migration).toContain("crop_zoom >= 1 and crop_zoom <= 4");
		expect(migration).toContain("crop_source in ('auto', 'user', 'moderator')");
	});
});
