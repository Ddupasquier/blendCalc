import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260726190000_fix_custom_food_relationship_issue_code.sql",
	"utf8",
);

describe("custom food relationship issue-code migration", () => {
	it("replaces the removed database message field with the stable issue code", () => {
		expect(migration).toContain("'select rule.message'");
		expect(migration).toContain("'select rule.issue_code'");
		expect(migration).toContain("prepare_custom_food_record()");
	});
});
