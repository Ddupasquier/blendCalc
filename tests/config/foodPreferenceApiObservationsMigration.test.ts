import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve("supabase/migrations/20260621143000_food_preference_api_observations.sql"),
	"utf8",
);

describe("food preference API observations migration", () => {
	it("stores API-observed allergen, dietary, and ingredient reference data", () => {
		expect(migration).toContain(
			"create table public.food_preference_api_observations",
		);
		expect(migration).toContain("'open-food-facts'");
		expect(migration).toContain("'fdc-search'");
		expect(migration).toContain("'usda-branded-detail'");
		expect(migration).toContain("source_payload jsonb not null");
	});

	it("indexes option lookup fields and keeps the option catalog in sync", () => {
		expect(migration).toContain(
			"food_preference_api_observations_category_value_idx",
		);
		expect(migration).toContain(
			"food_preference_api_observations_source_query_idx",
		);
		expect(migration).toContain("'api_observation'");
		expect(migration).toContain(
			"sync_food_preference_option_catalog_from_api_observations",
		);
		expect(migration).toContain(
			"create or replace function public.rebuild_food_preference_option_catalog()",
		);
		expect(migration).toContain(
			"delete from public.food_preference_option_catalog\n\twhere true;",
		);
	});

	it("uses RLS and restricts direct writes", () => {
		expect(migration).toContain(
			"alter table public.food_preference_api_observations force row level security;",
		);
		expect(migration).toContain(
			"Authenticated users can read food preference API observations",
		);
		expect(migration).toContain(
			"grant select on table public.food_preference_api_observations to authenticated;",
		);
	});
});
