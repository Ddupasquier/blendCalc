import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260814231000_category_led_food_symbol_resolution.sql",
	"utf8",
);
const databaseTypes = readFileSync("src/lib/types/database.types.ts", "utf8");
const schemaGuide = readFileSync("docs/development/supabase-schema.md", "utf8");

describe("category-led food symbol resolution migration", () => {
	it("stores family membership and explicit rule scopes in the database", () => {
		expect(migration).toContain("add column if not exists family_key");
		expect(migration).toContain("add column if not exists match_scopes");
		expect(migration).toContain("'prepared_override'");
		expect(migration).toContain("'category'");
		expect(migration).toContain("'name_refinement'");
		expect(migration).toContain("'uncategorized_name'");
	});

	it("resolves category families before same-family name refinements", () => {
		expect(migration).toContain("v_category_family_key");
		expect(migration).toContain(
			"definition.family_key = v_category_family_key",
		);
		expect(migration).toContain(
			"rule.match_scopes @> array['prepared_override']::text[]",
		);
		expect(migration).toContain(
			"rule.match_scopes @> array['uncategorized_name']::text[]",
		);
	});

	it("backfills every durable food snapshot owner", () => {
		for (const table of [
			"custom_foods",
			"shared_product_submissions",
			"shared_products",
			"shared_product_revisions",
			"user_food_list_items",
		]) {
			expect(migration).toContain(`update public.${table}`);
		}
	});

	it("keeps generated types and the schema guide synchronized", () => {
		expect(databaseTypes).toContain("family_key: string");
		expect(databaseTypes).toContain("match_scopes: string[]");
		expect(databaseTypes).toContain("resolve_food_symbol_key_for_category");
		expect(schemaGuide).toContain("`family_key`");
		expect(schemaGuide).toContain("`match_scopes`");
	});
});
