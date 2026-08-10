import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260718175500_cofid_nutrient_mappings.sql",
	"utf8",
);

describe("CoFID nutrient mappings migration", () => {
	it("maps core nutrition and major micronutrients through DB reference data", () => {
		for (const tag of [
			"PROT",
			"FAT",
			"CHO",
			"KCALS",
			"TOTSUG",
			"AOACFIB",
			"NA",
			"VITD",
			"VITC",
		]) {
			expect(migration).toContain(`'${tag}'`);
		}
		expect(migration).toContain("'standards_dataset'");
		expect(migration).toContain("'uk-cofid'");
	});
});
