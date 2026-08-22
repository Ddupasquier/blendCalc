import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260815110000_complete_partial_food_metadata_search.sql",
	"utf8",
);

describe("complete partial food metadata search migration", () => {
	it("indexes curated user-facing food metadata instead of arbitrary JSON", () => {
		for (const field of [
			"canonicalDescription",
			"sourceIdentifiers",
			"structuredIngredients",
			"ingredientAnalysis",
			"allergenDisclosure",
			"precautionaryStatements",
			"foodServings",
			"packageQuantity",
			"marketCountries",
		]) {
			expect(migration).toContain(field);
		}
		expect(migration).not.toContain("jsonb_each_text(p_food)");
	});

	it("backfills both canonical and private search indexes", () => {
		expect(migration).toContain("update public.shared_products");
		expect(migration).toContain("update public.custom_foods");
	});

	it("keeps API search field-aware while using partial term matching", () => {
		expect(migration).toContain(
			"create or replace function public.search_blendcalc_products_v1",
		);
		expect(migration).toContain("searchable_text.name_text");
		expect(migration).toContain("searchable_text.brand_text");
		expect(migration).toContain("searchable_text.category_text");
		expect(migration).toContain("strpos(searchable_text.all_text, term)");
	});
});
