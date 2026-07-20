import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260719223000_manual_entry_nutrient_ordering.sql",
	"utf8",
);

describe("manual-entry nutrient ordering migration", () => {
	it("creates stable per-group ordering without hardcoded nutrient lists", () => {
		expect(migration).toContain("partition by group_id");
		expect(migration).toContain("lower(display_label)");
		expect(migration).toContain("nutrient_id");
		expect(migration).toContain("stable_sort_order");
		expect(migration).toContain(
			"nutrient_manual_entry_fields_group_sort_idx",
		);
	});

	it("keeps the specialized Extended group titles readable", () => {
		expect(migration).toContain("Advanced Carbohydrate Details");
		expect(migration).toContain("Advanced Fat Details");
		expect(migration).toContain("Other Nutrients");
	});
});
