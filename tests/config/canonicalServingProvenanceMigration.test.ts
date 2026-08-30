import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260829231000_canonical_serving_provenance.sql",
	"utf8",
);

describe("canonical serving provenance migration", () => {
	it("links normalized servings through current or legacy serving provenance", () => {
		expect(migration).toContain(
			"provenance.field_path in ('serving', 'servingWeightGrams')",
		);
		expect(migration).toContain(
			"when provenance.field_path = 'serving' then 0 else 1",
		);
	});

	it("backfills complete serving provenance from existing exact weight evidence", () => {
		expect(migration).toContain("'servingWeightGrams'");
		expect(migration).toContain("'serving'");
		expect(migration).toContain("update public.food_servings");
	});
});
