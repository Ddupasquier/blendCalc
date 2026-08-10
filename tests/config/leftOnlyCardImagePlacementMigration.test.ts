import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260726170000_left_only_card_image_placement.sql",
	"utf8",
);

describe("left-only card image placement migration", () => {
	it("repairs current placements and prevents future right shifts", () => {
		expect(migration).toMatch(
			/update public\.food_image_assets[\s\S]*set crop_x = 50[\s\S]*placement_version >= 2[\s\S]*crop_x < 50/,
		);
		expect(migration).toContain(
			"food_image_assets_card_crop_x_check",
		);
		expect(migration).toMatch(
			/placement_version < 2[\s\S]*crop_x between 50 and 100/,
		);
	});
});
