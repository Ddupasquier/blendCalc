import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve(
		"supabase/migrations/20260731140000_lossless_precautionary_statements.sql",
	),
	"utf8",
);

describe("lossless precautionary statement migration", () => {
	it("stores exact statements, normalized allergens, and source context", () => {
		expect(migration).toContain("create table public.product_precautionary_statements");
		expect(migration).toContain("statement_text text not null");
		expect(migration).toContain("normalized_allergens text[] not null");
		expect(migration).toContain("source_observation_id uuid");
		expect(migration).toContain("shared_product_revision_id uuid");
	});

	it("keeps the four wording classes descriptive rather than risk-ranked", () => {
		for (const type of [
			"may_contain",
			"shared_equipment",
			"shared_facility",
			"other_precautionary",
		]) {
			expect(migration).toContain(`'${type}'`);
		}
		expect(migration).not.toMatch(/risk_(?:score|rank|level)/u);
	});

	it("links compatibility evidence to the exact statement, rule, and policy", () => {
		expect(migration).toContain("add column precautionary_statement_id uuid");
		expect(migration).toContain("precautionary_statement_id,");
		expect(migration).toContain("match_rule_id,");
		expect(migration).toContain("policy_version_id");
	});

	it("does not synthesize statements from the legacy traces array", () => {
		const syncFunction = migration.split(
			"create or replace function public.sync_product_precautionary_statements",
		)[1]?.split("alter table public.product_compatibility_facts")[0] ?? "";
		expect(syncFunction).toContain("p_food -> 'precautionaryStatements'");
		expect(syncFunction).not.toContain("p_food -> 'traces'");
	});
});
