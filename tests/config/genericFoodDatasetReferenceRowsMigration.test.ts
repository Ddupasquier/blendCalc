import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260718173500_generic_food_dataset_reference_rows.sql",
	"utf8",
);

describe("generic food dataset reference rows migration", () => {
	it("preserves source dictionaries without duplicating them per nutrient", () => {
		expect(migration).toContain(
			"create table public.generic_food_dataset_reference_rows",
		);
		expect(migration).toContain(
			"primary key (dataset_key, reference_type, source_key)",
		);
		expect(migration).toContain(
			"generic_food_dataset_reference_rows_lookup_idx",
		);
	});

	it("keeps imported reference data read-only for app users", () => {
		expect(migration).toContain(
			"Authenticated users can read active generic food reference rows",
		);
		expect(migration).toContain(
			"grant all on table public.generic_food_dataset_reference_rows to service_role",
		);
	});
});
