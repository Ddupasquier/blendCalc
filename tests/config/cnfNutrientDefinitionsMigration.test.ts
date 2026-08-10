import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260718174000_cnf_nutrient_definitions.sql",
	"utf8",
);

describe("CNF nutrient definitions migration", () => {
	it("adds official nutrients missing from the canonical dictionary", () => {
		expect(migration).toContain("'Mannitol', '260', 'G'");
		expect(migration).toContain("'25-hydroxycholecalciferol', '329', 'UG'");
		expect(migration).toContain("'Fructans (inulin)', '1001', 'G'");
		expect(migration).toContain(
			"nutrient_definitions_number_unique_idx",
		);
	});

	it("supports mappings sourced from standards datasets", () => {
		expect(migration).toContain("'standards_dataset'");
		expect(migration).toContain(
			"nutrient_source_mappings_mapping_method_check",
		);
	});
});
