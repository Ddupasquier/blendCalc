import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve("supabase/migrations/20260717213000_normalized_food_servings.sql"),
	"utf8",
);

describe("normalized food servings migration", () => {
	it("stores reusable servings with one parent and one primary row", () => {
		expect(migration).toContain("create table public.food_servings");
		expect(migration).toContain("food_servings_exactly_one_parent");
		expect(migration).toContain("food_servings_shared_product_primary_unique");
		expect(migration).toContain("gram_weight numeric not null");
		expect(migration).toContain("unit_key text references public.serving_measure_units");
	});

	it("syncs and backfills every food parent without exposing writes", () => {
		expect(migration).toContain("create function public.replace_food_servings");
		expect(migration).toContain("create function public.sync_food_servings_from_parent");
		expect(migration).toContain("from public.user_food_list_items item");
		expect(migration).toContain("from public.custom_foods food");
		expect(migration).toContain("from public.shared_products product");
		expect(migration).toContain("force row level security");
		expect(migration).toContain("grant select on table public.food_servings to authenticated");
		expect(migration).not.toContain("grant insert on table public.food_servings to authenticated");
	});
});
