import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260729220000_authoritative_normalized_field_lineage.sql",
	"utf8",
);

describe("authoritative normalized field lineage migration", () => {
	it("adds exact observation lineage to normalized servings", () => {
		expect(migration).toContain(
			"add column if not exists source_observation_id uuid",
		);
		expect(migration).toContain(
			"references public.shared_product_observations(id)",
		);
	});

	it("normalizes nutrients and servings from exact observations", () => {
		expect(migration).toContain(
			"create or replace function public.normalize_food_nutrient_lineage()",
		);
		expect(migration).toContain(
			"create or replace function public.normalize_food_serving_lineage()",
		);
		expect(migration).toContain(
			"new.source_observation_id := v_observation_id",
		);
	});

	it("keeps provider-derived rows without observations explicitly unknown", () => {
		expect(migration).toContain("new.source := 'unknown'");
		expect(migration).toContain("new.confidence := 'unknown'");
		expect(migration).not.toContain(
			"when 'usda' then 'source-verified'",
		);
	});
});
