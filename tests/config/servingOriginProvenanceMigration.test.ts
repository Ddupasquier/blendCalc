import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260731167000_serving_origin_and_conversion_provenance.sql",
	"utf8",
);

describe("serving origin and conversion provenance migration", () => {
	it("adds bounded origin and gram-weight method fields", () => {
		expect(migration).toContain("add column if not exists measure_type text");
		expect(migration).toContain("add column if not exists source_measure_key text");
		expect(migration).toContain("add column if not exists origin text");
		expect(migration).toContain("add column if not exists gram_weight_method text");
		expect(migration).toContain("'package-label'");
		expect(migration).toContain("'calculated-conversion'");
	});

	it("backfills only from exact serving rows or user evidence", () => {
		expect(migration).toContain("new.source_observation_id is not null");
		expect(migration).toContain(
			"(serving.value ->> 'gramWeight')::numeric = new.gram_weight",
		);
		expect(migration).toContain(
			"lower(btrim(serving.value ->> 'label')) = lower(btrim(new.label))",
		);
		expect(migration).toContain(
			"new.source = 'user-label' and new.owner_user_id is not null",
		);
		expect(migration).not.toContain("new.fdc_id");
	});

	it("leaves ambiguous values explicitly unknown", () => {
		expect(migration).toContain("else 'unknown'");
		expect(migration).toContain("update public.food_servings\nset origin = origin");
	});
});
