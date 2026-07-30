import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260730131000_record_barcode_nutrient_source_conflicts.sql",
	"utf8",
);

describe("barcode nutrition source conflict migration", () => {
	it("records exact USDA and Open Food Facts nutrient disagreement", () => {
		expect(migration).toContain(
			"insert into public.shared_product_conflicts",
		);
		expect(migration).toContain("'usda'");
		expect(migration).toContain("'open-food-facts'");
		expect(migration).toContain("'per 100 g'");
	});

	it("keeps conflicting values separate instead of averaging them", () => {
		expect(migration).toContain("usda_value");
		expect(migration).toContain("open_food_facts_value");
		expect(migration).not.toMatch(/avg\s*\(/iu);
	});

	it("creates one open review record per active product nutrient", () => {
		expect(migration).toContain(
			"'nutrient:' || conflict.nutrient_id::text",
		);
		expect(migration).toContain("existing.status = 'open'");
		expect(migration).toContain(
			"Expected % tracked nutrient conflicts but found %",
		);
	});
});
