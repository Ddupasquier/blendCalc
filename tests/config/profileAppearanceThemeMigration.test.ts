import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260728200000_profile_appearance_theme.sql",
	"utf8",
);

describe("profile appearance theme migration", () => {
	it("adds a safe account-level theme preference", () => {
		expect(migration).toContain("add column appearance_theme text not null");
		expect(migration).toContain("default 'system'");
		expect(migration).toContain(
			"appearance_theme in ('system', 'light', 'dark')",
		);
	});
});
