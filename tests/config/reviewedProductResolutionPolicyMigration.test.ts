import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260824120000_reviewed_product_resolution_policy.sql",
	"utf8",
);

describe("reviewed product resolution policy migration", () => {
	it("moves accuracy-sensitive product decisions into one versioned policy", () => {
		expect(migration).toContain(
			"create table public.product_resolution_policy_versions",
		);
		expect(migration).toContain(
			"create table public.product_resolution_rank_values",
		);
		expect(migration).toContain(
			"create table public.product_resolution_scoring_weights",
		);
		expect(migration).toContain(
			"create table public.product_resolution_difference_thresholds",
		);
		expect(migration).toContain("'exact-barcode-resolution-v1'");
		expect(migration).toContain("source_reference text not null");
		expect(migration).toContain("reviewed_at timestamptz not null");
	});

	it("stores expiring field-level lookup outcomes without exposing them to browsers", () => {
		expect(migration).toContain(
			"create table public.product_source_field_coverage",
		);
		expect(migration).toContain("expires_at timestamptz not null");
		expect(migration).toContain(
			"coverage_status in ('reported', 'not-reported', 'not-applicable', 'product-not-found')",
		);
		expect(migration).toContain(
			"These rows prevent redundant lookups but never become canonical product evidence.",
		);
		expect(migration).toContain(
			"revoke all on table public.product_source_field_coverage from public, anon, authenticated",
		);
		expect(migration).toContain(
			"grant all on table public.product_source_field_coverage to service_role",
		);
	});

	it("binds nutrition completeness scoring to the reviewed policy", () => {
		expect(migration).toContain("add column assessment_policy_key text");
		expect(migration).toContain("add column exact_source_score integer");
		expect(migration).toContain("add column required_nutrient_weight integer");
		expect(migration).toContain("add column partial_minimum_ratio numeric");
		expect(migration).toContain(
			"nutrition_completeness_profiles_source_score_order_check",
		);
	});
});
