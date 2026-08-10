import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260724153000_backfill_food_compatibility_match_facts.sql",
	"utf8",
);

describe("food compatibility match fact backfill migration", () => {
	it("derives canonical facts from reviewed database rules", () => {
		expect(migration).toContain(
			"from public.food_compatibility_match_rules rule",
		);
		expect(migration).toContain("when 'ingredients'");
		expect(migration).toContain("when 'description'");
		expect(migration).toContain("rule.source_key is null");
	});

	it("keeps invalid database regexes from breaking catalog writes", () => {
		expect(migration).toContain(
			"create or replace function public.compatibility_first_regex_match",
		);
		expect(migration).toContain("when invalid_regular_expression then");
	});

	it("synchronizes future catalog updates and backfills active products", () => {
		expect(migration).toContain(
			"create trigger sync_shared_product_rule_compatibility_from_food",
		);
		expect(migration).toContain("after insert or update of food, source");
		expect(migration).toContain(
			"select public.refresh_shared_product_compatibility_match_facts(product.id)",
		);
		expect(migration).toContain("where product.status = 'active'");
	});

	it("keeps rule refresh writes server-only", () => {
		expect(migration).toContain("from public, anon, authenticated");
		expect(migration).toContain("to service_role");
	});
});
