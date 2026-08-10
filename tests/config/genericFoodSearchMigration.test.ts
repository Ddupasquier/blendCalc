import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260718174500_generic_food_search.sql",
	"utf8",
);

describe("generic food search migration", () => {
	it("assigns stable application identifiers to imported foods", () => {
		expect(migration).toContain("application_food_id bigint generated always");
		expect(migration).toContain(
			"generic_food_records_application_food_id_idx",
		);
	});

	it("ranks partial generic-food matches in Postgres", () => {
		expect(migration).toContain(
			"function public.search_generic_food_records",
		);
		expect(migration).toContain("regexp_split_to_table");
		expect(migration).toContain("relevance_tier");
		expect(migration).toContain("public.similarity");
	});

	it("adds national datasets to reusable source and trust behavior", () => {
		expect(migration).toContain("'national-dataset'");
		expect(migration).toContain("'health-canada-cnf'");
		expect(migration).toContain("National food databases");
		expect(migration).toContain("then 'imported'");
	});

	it("keeps generic search behind authenticated database access", () => {
		expect(migration).toContain(
			"grant execute on function public.search_generic_food_records(text, integer)",
		);
		expect(migration).toContain("to authenticated, service_role");
	});
});
