import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260719170000_evidence_based_ingredient_verification.sql",
	"utf8",
);

describe("evidence-based ingredient verification migration", () => {
	it("does not infer verification from a provider name", () => {
		expect(migration).toContain("else 'unverified'");
		expect(migration).toContain("else 'unknown'");
		expect(migration).not.toContain(
			"when v_fallback_source = 'usda' then 'source-verified'",
		);
		expect(migration).not.toContain(
			"when v_fallback_source = 'open-food-facts' then 'imported'",
		);
	});

	it("accepts explicit evidence states and keeps pending review separate", () => {
		expect(migration).toContain("'source-verified'");
		expect(migration).toContain("'corroborated'");
		expect(migration).toContain("'moderator-reviewed'");
		expect(migration).toContain("then 'pending-review'");
	});

	it("rebuilds legacy custom projections without rerunning intake validation", () => {
		expect(migration).toContain(
			"disable trigger prepare_custom_food_record",
		);
		expect(migration).toContain(
			"enable trigger prepare_custom_food_record",
		);
	});

	it("removes origin and import hierarchy from user-facing options", () => {
		expect(migration).toContain("where dimension = 'source'");
		expect(migration).toContain("filter_enabled = false");
		expect(migration).toContain("badge_enabled = false");
		expect(migration).toContain("'No provider-independent verification evidence has been recorded.'");
		expect(migration).toContain("'No provider origin has been recorded for this ingredient.'");
	});
});
