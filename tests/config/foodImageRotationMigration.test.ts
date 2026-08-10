import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260728120000_food_image_rotation.sql",
	"utf8",
);

describe("food image rotation migration", () => {
	it("adds a safe zero-degree default for existing and new images", () => {
		expect(migration).toContain(
			"rotation_degrees smallint not null default 0",
		);
		expect(migration).toMatch(
			/update public\.food_image_assets[\s\S]*set rotation_degrees = 0/,
		);
	});

	it("limits persisted rotation to quarter turns", () => {
		expect(migration).toContain(
			"food_image_assets_rotation_degrees_check",
		);
		expect(migration).toContain(
			"rotation_degrees in (0, 90, 180, 270)",
		);
	});
});
