import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260724130000_food_compatibility_match_rules.sql",
	"utf8",
);

describe("food compatibility match rules migration", () => {
	it("restores the canonical compatibility tags and conflict rules", () => {
		expect(migration).toContain(
			"insert into public.compatibility_tags (slug, label, category)",
		);
		expect(migration).toContain(
			"insert into public.compatibility_rule_conflicts",
		);
		expect(migration).toContain("('gluten-free', 'wheat', 'warning')");
		expect(migration).toContain("('shellfish', 'shellfish', 'warning')");
	});

	it("stores reviewed ingredient and source-identity matching rules", () => {
		expect(migration).toContain(
			"create table public.food_compatibility_match_rules",
		);
		expect(migration).toContain("'label_ingredient_field'");
		expect(migration).toContain("'source_food_identity'");
		expect(migration).toContain(
			"grant select on table public.food_compatibility_match_rules",
		);
	});

	it("relinks existing user preference rows after restoring tags", () => {
		expect(migration).toContain(
			"select public.sync_user_compatibility_rules(",
		);
		expect(migration).toContain(
			"from public.user_food_preferences preferences;",
		);
	});
});
