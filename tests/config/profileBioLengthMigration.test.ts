import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260822120000_limit_profile_bio_length.sql",
	"utf8",
);

describe("profile bio length migration", () => {
	it("bounds existing and future profile biographies at 150 characters", () => {
		expect(migration).toContain("set bio = left(bio, 150)");
		expect(migration).toContain("where char_length(bio) > 150");
		expect(migration).toContain("drop constraint if exists profiles_bio_check");
		expect(migration).toContain("char_length(bio) <= 150");
	});
});
