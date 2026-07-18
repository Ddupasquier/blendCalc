import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260717233000_source_product_name_formatting.sql",
	"utf8",
);

describe("source product name formatting migration", () => {
	it("updates every rendered source-backed product copy", () => {
		expect(migration).toContain("update public.shared_products");
		expect(migration).toContain("update public.custom_foods");
		expect(migration).toContain("update public.user_food_list_items");
		expect(migration).toContain("'{nameProvenance}'");
	});

	it("never overwrites a user-owned name", () => {
		expect(migration.match(/nameProvenance' is distinct from 'user'/g)).toHaveLength(3);
	});

	it("temporarily bypasses legacy custom-food validation and restores it", () => {
		const disableIndex = migration.indexOf(
			"disable trigger prepare_custom_food_record",
		);
		const updateIndex = migration.indexOf("update public.custom_foods");
		const enableIndex = migration.indexOf(
			"enable trigger prepare_custom_food_record",
		);

		expect(disableIndex).toBeGreaterThan(-1);
		expect(updateIndex).toBeGreaterThan(disableIndex);
		expect(enableIndex).toBeGreaterThan(updateIndex);
	});
});
