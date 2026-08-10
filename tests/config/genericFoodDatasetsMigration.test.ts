import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260718173000_generic_food_datasets.sql",
	"utf8",
);

describe("generic food datasets migration", () => {
	it("stores dataset, food, nutrient, and measure records separately", () => {
		for (const table of [
			"generic_food_datasets",
			"generic_food_records",
			"generic_food_nutrients",
			"generic_food_measures",
		]) {
			expect(migration).toContain(`create table public.${table}`);
		}
		expect(migration).toContain(
			"nutrient_id bigint references public.nutrient_definitions",
		);
	});

	it("indexes search, nutrient, and serving lookup paths", () => {
		for (const index of [
			"generic_food_records_search_vector_idx",
			"generic_food_records_search_trgm_idx",
			"generic_food_nutrients_canonical_idx",
			"generic_food_nutrients_food_idx",
			"generic_food_measures_household_idx",
		]) {
			expect(migration).toContain(index);
		}
	});

	it("records source licences before imports are allowed", () => {
		expect(migration).toContain("'cnf-2026'");
		expect(migration).toContain("'cofid-2021'");
		expect(migration).toContain("'afcd-release-3'");
		expect(migration).toContain(
			"check (not import_enabled or license_review_status = 'approved')",
		);
		expect(migration).toMatch(
			/'afcd-release-3'[\s\S]+?'requires_acceptance'[\s\S]+?false/,
		);
	});

	it("keeps imported data read-only for authenticated users", () => {
		expect(migration).toContain(
			"Authenticated users can read active generic food records",
		);
		expect(migration).toContain(
			"grant select on table public.generic_food_nutrients to authenticated",
		);
		expect(migration).toContain(
			"grant all on table public.generic_food_nutrients to service_role",
		);
	});
});
