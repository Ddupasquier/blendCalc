import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve(
		"supabase/migrations/20260620170000_remove_legacy_food_preference_fields.sql",
	),
	"utf8",
);

describe("user food preference compatibility trigger migration", () => {
	it("syncs compatibility rules from user_food_preferences automatically", () => {
		expect(migration).toContain(
			"create or replace function public.handle_user_food_preferences_compatibility_sync()",
		);
		expect(migration).toContain(
			"create trigger sync_user_food_preferences_compatibility_rules",
		);
		expect(migration).toContain(
			"after insert or update of allergens, dietary_restrictions",
		);
	});

	it("clears user compatibility rules when preferences are deleted", () => {
		expect(migration).toContain("if tg_op = 'DELETE' then");
		expect(migration).toContain("'{}'::text[]");
	});

	it("drops legacy preference columns and rule types", () => {
		expect(migration).toContain("drop column if exists food_preferences,");
		expect(migration).toContain("drop column if exists ingredients_to_avoid;");
		expect(migration).toContain(
			"where rule_type in ('ingredient_avoid', 'dislike');",
		);
	});

	it("removes direct authenticated rpc execution", () => {
		expect(migration).toContain(
			"revoke all on function public.sync_user_compatibility_rules(",
		);
		expect(migration).toContain("from public, anon, authenticated;");
	});
});
