import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260726225500_usda_serving_measure_aliases.sql",
	"utf8",
);
const localSeed = readFileSync("supabase/seed.sql", "utf8");

describe("USDA serving-measure alias migration", () => {
	it("does not require reference rows to exist during clean migration replay", () => {
		expect(migration).toContain(
			"where exists (\n\tselect 1\n\tfrom public.serving_measure_units",
		);
		expect(migration).toContain("where unit.key = 'g'");
	});

	it("seeds the provider alias after local reference units exist", () => {
		expect(localSeed).toContain("'GRM'");
		expect(localSeed).toContain("'grm'");
		expect(localSeed).toContain("'usda'");
	});
});
