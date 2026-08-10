import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260726223000_generic_food_source_identifiers.sql",
	"utf8",
);
const searchOptimizationMigration = readFileSync(
	"supabase/migrations/20260726224000_optimize_generic_food_search.sql",
	"utf8",
);

describe("generic food source identifiers migration", () => {
	it("stores only explicit cross-source identifiers", () => {
		expect(migration).toContain(
			"create table public.generic_food_source_identifiers",
		);
		expect(migration).toContain("'source-reference'");
		expect(migration).toContain("'exact-identifier'");
		expect(migration).not.toContain("'fuzzy-match'");
	});

	it("backfills the CNF-declared USDA NDB reference", () => {
		expect(migration).toContain("record.dataset_key = 'cnf-2026'");
		expect(migration).toContain("'ndb-number'");
		expect(migration).toContain("'USDA_NDB_Code'");
	});

	it("keeps nutrient-empty records out of generic search", () => {
		expect(migration).toContain(
			"exists (\n\t\t\t\tselect 1\n\t\t\t\tfrom public.generic_food_nutrients nutrient",
		);
		expect(migration).toContain("nutrient.value_status = 'measured'");
		expect(migration).toContain("source_identifiers jsonb");
	});

	it("removes source-derived rows from the private custom-food table", () => {
		expect(migration).toContain("delete from public.custom_foods custom_food");
		expect(migration).toContain("custom_food.source_key");
		expect(migration).toContain("'customFood'");
	});

	it("uses indexed prefix search and a searchable-nutrient index", () => {
		expect(searchOptimizationMigration).toContain(
			"generic_food_nutrients_searchable_food_idx",
		);
		expect(searchOptimizationMigration).toContain(
			"record.search_vector @@ query.search_value",
		);
		expect(searchOptimizationMigration).toContain(
			"string_agg(terms.term || ':*'",
		);
	});
});
