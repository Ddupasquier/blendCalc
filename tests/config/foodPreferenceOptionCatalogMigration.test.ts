import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve("supabase/migrations/20260618210000_food_preference_option_catalog.sql"),
	"utf8",
);

describe("food preference option catalog migration", () => {
	it("creates the catalog table and rebuild function", () => {
		expect(migration).toContain("create table public.food_preference_option_catalog");
		expect(migration).toContain(
			"create or replace function public.rebuild_food_preference_option_catalog()",
		);
	});

	it("sources allergen and dietary options from compatibility facts", () => {
		expect(migration).toContain("'allergen'");
		expect(migration).toContain("'dietary'");
		expect(migration).toContain("from public.product_compatibility_facts fact");
	});

	it("sources ingredient options from explicit ingredient lists", () => {
		expect(migration).toContain("'ingredient_list'");
		expect(migration).toContain("jsonb_array_elements_text(");
		expect(migration).toContain("product.food -> 'ingredientList'");
	});
});
