import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260801104000_reviewed_extended_manual_entry_catalog.sql",
	"utf8",
);

describe("reviewed Extended manual-entry catalog migration", () => {
	it("installs the reviewed DB-owned Extended groups and fields", () => {
		expect(migration).toContain("'amino-acids'");
		expect(migration).toContain("'advanced-carbohydrate-details'");
		expect(migration).toContain("'advanced-fat-details'");
		expect(migration).toContain("'carotenoids'");
		expect(migration).toContain("'other-nutrients'");
		expect(migration).toContain("(1099, 'Fluoride, F'");
		expect(migration).toContain("(1102, 'Molybdenum, Mo'");
		expect(migration).toContain("(1007, 'Ash'");
	});

	it("keeps source observations separate from reviewed UI policy", () => {
		expect(migration).not.toContain(
			"insert into public.nutrient_manual_entry_observations",
		);
		expect(migration).toContain("'blendcalc-manual-entry-policy'");
		expect(migration).toContain("classification_version = 3");
	});
});
