import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve(
		"supabase/migrations/20260729150000_complete_food_compatibility_policy.sql",
	),
	"utf8",
);

describe("complete food compatibility policy migration", () => {
	it("expands reviewed source evidence without enabling packaged identity guesses", () => {
		expect(migration).toContain("'ingredient_analysis'");
		expect(migration).toContain("'source_dietary_analysis'");
		expect(migration).toContain("'dietary_conflict'");
		expect(migration).toContain("'generic_food_identity'");
		expect(migration).not.toContain("'description', 'source_food_identity'");
		expect(migration).not.toContain("'food_category', 'source_food_identity'");
	});

	it("adds global allergen aliases and land-animal dietary evidence as DB policy", () => {
		expect(migration).toContain("('mustard', 'Mustard', 'allergen')");
		expect(migration).toContain("('mollusc', 'Mollusc', 'allergen')");
		expect(migration).toContain("('sulfite', 'Sulphites / Sulfites', 'allergen')");
		expect(migration).toContain("('meat', 'Meat', 'avoidance')");
		expect(migration).toContain("('vegan', 'meat', 'warning', 10)");
		expect(migration).toContain("('vegetarian', 'meat', 'warning', 10)");
		expect(migration).toContain("('halal', 'pork', 'warning', 1)");
	});

	it("rebuilds all parent facts and prevents refreshes from erasing derived evidence", () => {
		expect(migration).toContain(
			"create or replace function public.extract_product_compatibility_facts(",
		);
		expect(migration).toContain(
			"create or replace function public.refresh_shared_product_compatibility_match_facts(",
		);
		expect(migration).toContain(
			"from public.shared_product_observations observation;",
		);
		expect(migration).toContain(
			"from public.shared_product_submissions submission;",
		);
		expect(migration).toContain(
			") nulls not distinct;",
		);
	});

	it("adds a service-only coverage guard for selectable preferences", () => {
		expect(migration).toContain(
			"'compatibility_tag',\n\t\t\t\t'compatibility_fact'",
		);
		expect(migration).toContain(
			"create view public.food_compatibility_policy_coverage",
		);
		expect(migration).toContain(
			"and exists (\n\t\t\t\t\tselect 1\n\t\t\t\t\tfrom public.compatibility_rule_conflicts conflict",
		);
		expect(migration).toContain(
			"revoke all on public.food_compatibility_policy_coverage",
		);
	});
});
