import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve("supabase/migrations/20260618204000_remove_compatibility_text_fallback.sql"),
	"utf8",
);

describe("remove compatibility text fallback migration", () => {
	it("removes ingredient-parse facts and old text helper functions", () => {
		expect(migration).toContain("drop table if exists public.compatibility_tag_aliases;");
		expect(migration).toContain("delete from public.product_compatibility_facts");
		expect(migration).toContain("where source_type = 'ingredient_parse';");
		expect(migration).toContain("drop function if exists public.compatibility_food_text(jsonb);");
		expect(migration).toContain(
			"drop function if exists public.compatibility_text_has_term(text, text);",
		);
	});

	it("redefines compatibility extraction without alias or regex parsing", () => {
		expect(migration).toContain("create or replace function public.extract_product_compatibility_facts(");
		expect(migration).toContain("join public.compatibility_tags tag");
		expect(migration).not.toContain("compatibility_tag_aliases alias");
		expect(migration).toContain("where source_type = 'ingredient_parse';");
	});
});
