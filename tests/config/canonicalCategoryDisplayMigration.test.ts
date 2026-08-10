import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260719214000_canonical_category_display.sql",
	"utf8",
).toLowerCase();

describe("canonical category display migration", () => {
	it("writes canonical category labels into stored food payloads", () => {
		expect(migration).toContain("sync_canonical_food_category_display");
		expect(migration).toContain("'{foodcategory}'");
		expect(migration).toContain("custom_food_category_options");
		expect(migration).toContain("category.label");
	});

	it("backfills custom, catalog, revision, submission, and saved-list foods", () => {
		expect(migration).toContain("update public.custom_foods");
		expect(migration).toContain("update public.shared_product_submissions");
		expect(migration).toContain("update public.shared_products");
		expect(migration).toContain("update public.shared_product_revisions");
		expect(migration).toContain("update public.user_food_list_items");
	});

	it("keeps future custom and list records synchronized in the database", () => {
		expect(migration).toContain("zz_sync_canonical_food_category_display");
		expect(migration).toContain("zz_sync_user_food_category_display");
		expect(migration).toContain("before insert or update of food");
	});
});
