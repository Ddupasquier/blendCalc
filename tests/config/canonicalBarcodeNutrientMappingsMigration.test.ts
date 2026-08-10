import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260727120000_canonical_barcode_nutrient_mappings.sql",
	"utf8",
);

describe("canonical barcode nutrient mappings migration", () => {
	it("restores reviewed Open Food Facts label mappings", () => {
		expect(migration).toContain(
			"('open-food-facts', 'fat', 'G', 'Fat', 1004",
		);
		expect(migration).toContain(
			"('open-food-facts', 'sodium', 'G', 'Sodium', 1093",
		);
		expect(migration).toContain("'db_reviewed_api_key_match'");
		expect(migration).toContain("'approved'");
	});

	it("backfills every persisted food parent through DB equivalences", () => {
		expect(migration).toContain(
			"pg_temp.canonicalize_barcode_food_nutrients",
		);
		for (const table of [
			"user_food_list_items",
			"custom_foods",
			"shared_product_submissions",
			"shared_products",
			"shared_product_revisions",
			"shared_product_observations",
		]) {
			expect(migration).toContain(`public.${table}`);
		}
		expect(migration).toContain("public.nutrient_equivalences");
	});
});
