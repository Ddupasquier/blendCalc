import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260715201000_product_reference_data.sql",
	"utf8",
);

describe("product reference data migration", () => {
	it("normalizes sources, nutrient mappings, conversions, and serving units", () => {
		for (const table of [
			"product_data_sources",
			"nutrient_source_mappings",
			"nutrient_unit_conversions",
			"serving_measure_units",
			"serving_measure_aliases",
		]) {
			expect(migration).toContain(`create table public.${table}`);
		}
		expect(migration).toContain(
			"nutrient_id bigint not null references public.nutrient_definitions",
		);
		expect(migration).toContain(
			"source_key text not null references public.product_data_sources",
		);
	});

	it("indexes runtime lookup paths", () => {
		expect(migration).toContain("nutrient_source_mappings_lookup_idx");
		expect(migration).toContain("nutrient_unit_conversions_lookup_idx");
		expect(migration).toContain("serving_measure_units_enabled_idx");
		expect(migration).toContain("serving_measure_aliases_unit_idx");
	});

	it("seeds stable source identities without API observations", () => {
		const sourceIdentityInsert = migration.match(
			/insert into public\.product_data_sources \([\s\S]+?on conflict \(key\) do update[\s\S]+?;/i,
		)?.[0];

		expect(sourceIdentityInsert).toBeTruthy();
		for (const sourceKey of [
			"usda",
			"open-food-facts",
			"shared-catalog",
			"ucum-nlm",
		]) {
			expect(sourceIdentityInsert).toContain(`'${sourceKey}'`);
		}
		expect(sourceIdentityInsert).toContain('"identityOwner":"migration"');
		expect(sourceIdentityInsert).not.toMatch(
			/\b(observation_count|first_observed_at|last_observed_at)\b/i,
		);
		expect(migration).not.toMatch(
			/insert into public\.(nutrient_source_mappings|nutrient_unit_conversions|serving_measure_units|serving_measure_aliases)/i,
		);
	});

	it("allows authenticated reads and service-role writes", () => {
		expect(migration).toContain(
			"Authenticated users can read nutrient source mappings",
		);
		expect(migration).toContain(
			"grant select on table public.serving_measure_units to authenticated",
		);
		expect(migration).toContain(
			"grant all on table public.nutrient_source_mappings to service_role",
		);
	});
});
