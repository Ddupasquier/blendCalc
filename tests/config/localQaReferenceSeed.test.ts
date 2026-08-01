import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync("supabase/seed.sql", "utf8");

describe("local QA reference seed", () => {
	it("hydrates the DB-driven manual-entry catalogs", () => {
		expect(seed).toContain("public.nutrient_manual_entry_groups");
		expect(seed).toContain("public.nutrient_manual_entry_fields");
		expect(seed).toContain("local-qa-reference-fixture-v1");
	});

	it("hydrates serving measures and searchable categories", () => {
		expect(seed).toContain("public.serving_measure_units");
		expect(seed).toContain("public.serving_measure_aliases");
		expect(seed).toContain("public.custom_food_category_options");
		expect(seed).toContain("public.food_preference_option_catalog");
		expect(seed).toContain("'Nut & Seed Butters'");
	});

	it("includes a deterministic category catalog beyond the former row cutoff", () => {
		expect(seed).toContain("generate_series(1, 1005)");
		expect(seed).toContain("'qa-yogurts'");
		expect(seed).toContain("'Yogurts'");
		expect(seed).toContain("'local-qa-scale-fixture'");
	});

	it("provides publishable catalog products without live provider requests", () => {
		expect(seed).toContain("qa_catalog_product_fixtures");
		expect(seed).toContain("'00021130462506'");
		expect(seed).toContain("'00021130493609'");
		expect(seed).toContain("'08801005523455'");
		expect(seed).toContain("'00869759000149'");
		expect(seed).toContain("'00011110904416'");
		expect(seed).toContain("public.shared_product_field_provenance");
		expect(seed).toContain("public.food_nutrients");
		expect(seed).toContain("public.food_servings");
	});

	it("restores canonical validation rules after destructive QA", () => {
		expect(seed).toContain("update public.nutrient_relationship_rules");
		expect(seed).toContain("where source = 'nutrient_definitions'");
	});

	it("contains no users or private product records", () => {
		expect(seed).not.toContain("auth.users");
		expect(seed).not.toContain("public.profiles");
		expect(seed).not.toContain("public.custom_foods");
		expect(seed).not.toContain("public.product_submission_evidence");
	});
});
