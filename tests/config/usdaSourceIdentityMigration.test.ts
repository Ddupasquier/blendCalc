import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260717200000_usda_source_identity.sql",
	"utf8",
);

describe("USDA source identity migration", () => {
	it("uses USDA for ingredient source filters and badges", () => {
		expect(migration).toContain("filter_label = 'USDA'");
		expect(migration).toContain("badge_label = 'USDA'");
		expect(migration).toContain("where value = 'fdc'");
	});

	it("backfills USDA provenance into saved food JSON", () => {
		expect(migration).toContain("update public.shared_products");
		expect(migration).toContain("update public.custom_foods");
		expect(migration).toContain("'sourceDataType'");
		expect(migration).toContain("public.product_data_sources");
		expect(migration).toContain("custom_food.category_option_id is not null");
	});
});
