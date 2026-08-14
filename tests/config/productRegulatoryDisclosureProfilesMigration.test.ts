import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260814120000_product_regulatory_disclosure_profiles.sql",
	"utf8",
);

describe("product regulatory disclosure profiles migration", () => {
	it("stores reviewed disclosure policy separately from product observations", () => {
		expect(migration).toContain(
			"create table public.product_regulatory_disclosure_profiles",
		);
		expect(migration).toContain("nutrition_evaluation_mode");
		expect(migration).toContain("nutrition_profile_key");
		expect(migration).toContain("requires_moderator_review");
		expect(migration).toContain("source_reference");
	});

	it("covers standard, alcohol, kombucha, sparse, and unknown contexts", () => {
		for (const profileKey of [
			"unknown-label-context-v1",
			"us-standard-nutrition-facts-v1",
			"us-ttb-alcohol-beverage-v1",
			"us-ttb-kombucha-case-specific-v1",
			"us-permitted-sparse-label-v1",
		]) {
			expect(migration).toContain(`'${profileKey}'`);
		}
	});

	it("keeps ABV, reported zero, and missing data distinct", () => {
		expect(migration).toContain("food_alcohol_disclosure_is_valid");
		expect(migration).toContain("'reported', 'reported-zero'");
		expect(migration).toContain("v_status = 'reported-zero' and v_percent <> 0");
		expect(migration).toContain("v_status = 'reported' and v_percent = 0");
		expect(migration).not.toContain("coalesce(v_percent, 0)");
	});

	it("validates catalog, submission, and revision snapshots", () => {
		expect(migration).toContain(
			"shared_product_submissions_alcohol_disclosure_check",
		);
		expect(migration).toContain("shared_products_alcohol_disclosure_check");
		expect(migration).toContain(
			"shared_product_revisions_alcohol_disclosure_check",
		);
		expect(migration).toContain(
			"validate_food_regulatory_disclosure_profile",
		);
	});
});
