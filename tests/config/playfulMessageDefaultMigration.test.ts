import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260822100000_enable_playful_messages_by_default.sql",
	"utf8",
);

describe("playful message default migration", () => {
	it("enables playful messages for existing and future profiles", () => {
		expect(migration).toContain(
			"alter column cheeky_messages_enabled set default true",
		);
		expect(migration).toContain("set cheeky_messages_enabled = true");
		expect(migration).toContain("where cheeky_messages_enabled = false");
	});

	it("keeps the preference user-disableable and away from safety contexts", () => {
		expect(migration).toContain("remains user-disableable");
		expect(migration).toContain("eligible non-safety contexts");
	});
});
