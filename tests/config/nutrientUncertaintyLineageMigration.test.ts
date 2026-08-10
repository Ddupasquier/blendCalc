import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260731168000_nutrient_uncertainty_lineage.sql",
	"utf8",
);

describe("nutrient uncertainty lineage migration", () => {
	it("adds bounded uncertainty and source-mapping columns", () => {
		expect(migration).toContain("add column if not exists value_status text");
		expect(migration).toContain("add column if not exists standard_error numeric");
		expect(migration).toContain("add column if not exists source_nutrient_code text");
		expect(migration).toContain("add column if not exists mapping_status text");
		expect(migration).toContain("add column if not exists mapping_review_reference text");
		expect(migration).toContain("add column if not exists derivation_method text");
	});

	it("backfills through exact parent nutrient records", () => {
		expect(migration).toContain("private.apply_food_nutrient_uncertainty()");
		expect(migration).toContain("(nutrient.value ->> 'nutrientId')::bigint = new.nutrient_id");
		expect(migration).toContain("update public.food_nutrients\nset amount_per_100g = amount_per_100g");
	});

	it("keeps complete generic source rows separate from accepted numeric values", () => {
		expect(migration).toContain("'valueStatus', nutrient.value_status");
		expect(migration).toContain("'mappingStatus', nutrient.mapping_status");
		expect(migration).not.toContain("nutrient.value_status = 'measured'\n\t\t\tand nutrient.amount_per_100g is not null");
	});
});
