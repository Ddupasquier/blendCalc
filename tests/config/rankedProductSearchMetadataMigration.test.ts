import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260814235000_expand_ranked_product_search_metadata.sql",
	"utf8",
);

describe("ranked product search metadata migration", () => {
	it("indexes useful stored identity, category, and supporting metadata", () => {
		for (const field of [
			"alternateDescription",
			"scientificName",
			"brandOwner",
			"foodCategory",
			"brandedFoodCategory",
			"preparation",
			"marketCountry",
			"ingredientList",
			"additives",
			"categories",
			"sourceCategories",
			"marketCountries",
		]) {
			expect(migration).toContain(field);
		}
	});

	it("backfills shared and private searchable records", () => {
		expect(migration).toContain("update public.shared_products");
		expect(migration).toContain("update public.custom_foods");
	});
});
