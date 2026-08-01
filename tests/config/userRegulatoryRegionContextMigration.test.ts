import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260731150000_user_regulatory_region_context.sql",
	"utf8",
);

describe("user regulatory region context migration", () => {
	it("stores a bounded region selection and its origin on food preferences", () => {
		expect(migration).toContain("add column regulatory_region_code text");
		expect(migration).toContain("add column regulatory_region_source text");
		expect(migration).toContain("'account', 'device'");
		expect(migration).toContain(
			"user_food_preferences_regulatory_region_pair_check",
		);
	});

	it("validates saved regions against the active policy bundle", () => {
		expect(migration).toContain(
			"validate_user_food_preference_regulatory_region",
		);
		expect(migration).toContain(
			"active_food_compatibility_policy_version_id()",
		);
		expect(migration).toContain("profile.region_code = new.regulatory_region_code");
	});

	it("documents that regional context cannot suppress personal warnings", () => {
		expect(migration).toContain(
			"never suppresses personal warnings",
		);
	});
});
