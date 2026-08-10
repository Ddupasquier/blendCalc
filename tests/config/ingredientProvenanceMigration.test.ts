import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260718003000_ingredient_provenance_filters.sql",
	"utf8",
);

describe("ingredient provenance migration", () => {
	it("separates source and trust reference options", () => {
		expect(migration).toContain("create table public.ingredient_provenance_options");
		expect(migration).toContain("dimension in ('source', 'trust')");
		expect(migration).toContain("'open-food-facts'");
		expect(migration).toContain("'source-verified'");
		expect(migration).toContain("'moderator-reviewed'");
	});

	it("stores and indexes resolved list provenance", () => {
		expect(migration).toContain("add column source_key text generated always as");
		expect(migration).toContain("add column trust_status text generated always as");
		expect(migration).toContain("user_food_list_items_source_filter_idx");
		expect(migration).toContain("user_food_list_items_trust_filter_idx");
		expect(migration).toContain("custom_foods_source_filter_idx");
	});

	it("backfills shared, custom, and list records", () => {
		expect(migration).toContain("update public.shared_products as product");
		expect(migration).toContain("update public.custom_foods");
		expect(migration).toContain("update public.user_food_list_items as list_item");
	});

	it("keeps UI reference options read-only", () => {
		expect(migration).toContain(
			"alter table public.ingredient_provenance_options force row level security",
		);
		expect(migration).toContain(
			"Authenticated users can read ingredient provenance options",
		);
		expect(migration).toContain(
			"grant select on table public.ingredient_provenance_options to authenticated",
		);
	});
});
