import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260715120000_shared_product_canonical_categories.sql",
	"utf8",
);

describe("shared product canonical categories migration", () => {
	it("links submissions, products, and revisions to category options", () => {
		for (const table of [
			"shared_product_submissions",
			"shared_products",
			"shared_product_revisions",
		]) {
			expect(migration).toContain(`alter table public.${table}`);
		}
		expect(migration.match(/references public\.custom_food_category_options/g)).toHaveLength(3);
	});

	it("indexes each canonical category foreign key", () => {
		expect(migration).toContain("shared_product_submissions_category_option_idx");
		expect(migration).toContain("shared_products_category_option_idx");
		expect(migration).toContain("shared_product_revisions_category_option_idx");
	});

	it("resolves categories in the database and rejects uncategorized publication", () => {
		expect(migration).toContain("resolve_custom_food_category_option");
		expect(migration).toContain("set_shared_product_category_from_submission");
		expect(migration).toContain(
			"A canonical food category is required before publishing a shared product",
		);
		expect(migration).toContain("set_shared_product_revision_category");
	});

	it("keeps category resolution unavailable to anonymous callers", () => {
		expect(migration).toMatch(
			/revoke all on function public\.resolve_custom_food_category_option\(text\[\]\)[\s\S]*from public, anon, authenticated/,
		);
		expect(migration).toMatch(
			/grant execute on function public\.resolve_custom_food_category_option\(text\[\]\)[\s\S]*to authenticated, service_role/,
		);
	});
});
