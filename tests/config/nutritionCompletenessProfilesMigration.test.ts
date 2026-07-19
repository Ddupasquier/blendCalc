import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260718170000_nutrition_completeness_profiles.sql",
	"utf8",
);

describe("nutrition completeness profiles migration", () => {
	it("stores scoped completeness rules instead of a runtime nutrient list", () => {
		expect(migration).toContain(
			"create table public.nutrition_completeness_profiles",
		);
		expect(migration).toContain(
			"create table public.nutrition_completeness_profile_nutrients",
		);
		expect(migration).toContain("'generic-core-v1'");
		expect(migration).toContain("'us-packaged-label-v1'");
		expect(migration).toContain("requirement_level in ('required', 'recommended')");
	});

	it("resolves canonical nutrients through nutrient definitions", () => {
		expect(migration).toContain(
			"join public.nutrient_definitions definitions",
		);
		expect(migration).toContain(
			"definitions.nutrient_number = profile_nutrients.nutrient_number",
		);
		expect(migration).toContain("if v_generic_count <> 7");
		expect(migration).toContain("if v_packaged_count <> 15");
	});

	it("indexes enabled runtime lookups", () => {
		expect(migration).toContain(
			"nutrition_completeness_profiles_runtime_idx",
		);
		expect(migration).toContain(
			"nutrition_completeness_profile_nutrients_runtime_idx",
		);
	});

	it("allows authenticated reads and service-role writes", () => {
		expect(migration).toContain(
			"Authenticated users can read nutrition completeness profiles",
		);
		expect(migration).toContain(
			"grant select on table public.nutrition_completeness_profiles to authenticated",
		);
		expect(migration).toContain(
			"grant all on table public.nutrition_completeness_profile_nutrients to service_role",
		);
	});
});
