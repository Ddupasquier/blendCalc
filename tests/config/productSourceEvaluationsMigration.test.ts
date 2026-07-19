import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260718180000_product_source_evaluations.sql",
	"utf8",
);

describe("product source evaluations migration", () => {
	it("keeps retired providers out of the live fallback chain", () => {
		expect(migration).toContain("'foodrepo'");
		expect(migration).toContain("'lifecycle_status', 'retired'");
		expect(migration).toContain("'retired_on', '2026-02-28'");
		expect(migration).toMatch(/'The Open Food Repo'[\s\S]*?false,/);
	});

	it("records why the planned benchmark did not make external calls", () => {
		expect(migration).toContain("create table public.product_source_evaluations");
		expect(migration).toContain("'planned_sample_size', 200");
		expect(migration).toContain("'Coverage benchmarking was not run because the provider retired");
	});

	it("indexes evaluations and limits writes to the service role", () => {
		expect(migration).toContain("product_source_evaluations_source_idx");
		expect(migration).toContain("product_source_evaluations_decision_idx");
		expect(migration).toContain(
			"grant all on table public.product_source_evaluations to service_role",
		);
	});
});
