import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260805130000_preserve_nutrient_estimate_qualifiers.sql",
	"utf8",
);

describe("nutrient estimate qualifier migration", () => {
	it("stores source estimates separately from reported nutrient values", () => {
		expect(migration).toContain("add column if not exists value_qualifier text");
		expect(migration).toContain("value_origin in ('reported', 'estimated', 'derived')");
		expect(migration).toContain(
			"value_status = 'estimated' and value_origin = 'estimated'",
		);
		expect(migration).toContain(
			"value_status = 'estimated' and value_qualifier = 'source-estimate'",
		);
	});

	it("rehydrates existing normalized rows from their exact parent snapshot", () => {
		expect(migration).toContain(
			"create or replace function private.apply_food_nutrient_uncertainty()",
		);
		expect(migration).toContain(
			"when v_value_qualifier = 'source-estimate' then 'estimated'",
		);
		expect(migration).toContain(
			"update public.food_nutrients\nset amount_per_100g = amount_per_100g;",
		);
	});
});
