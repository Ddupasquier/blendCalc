import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260718175000_generic_nutrient_value_status.sql",
	"utf8",
);

describe("generic nutrient value status migration", () => {
	it("preserves trace and unquantified values without turning them into zero", () => {
		expect(migration).toContain("'trace'");
		expect(migration).toContain("'present-unquantified'");
		expect(migration).toContain(
			"value_status <> 'measured' and amount_per_100g is null",
		);
	});

	it("keeps volume-basis records out of weight-based search", () => {
		expect(migration).toContain("measurement_basis");
		expect(migration).toContain("record.measurement_basis = 'per_100g'");
		expect(migration).toContain("per100mlFoodGroupPrefixes");
	});
});
