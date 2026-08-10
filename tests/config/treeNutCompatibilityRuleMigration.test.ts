import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260724155000_expand_tree_nut_compatibility_rule.sql",
	"utf8",
);

describe("tree nut compatibility rule migration", () => {
	it("matches singular and plural source ingredient terms", () => {
		for (const term of [
			"almonds?",
			"cashews?",
			"hazelnuts?",
			"pecans?",
			"pistachios?",
			"walnuts?",
			"macadamias?",
			"brazil nuts?",
		]) {
			expect(migration).toContain(term);
		}
	});

	it("reruns the canonical compatibility fact backfill", () => {
		expect(migration).toContain(
			"select public.refresh_shared_product_compatibility_match_facts(product.id)",
		);
		expect(migration).toContain("where product.status = 'active'");
	});
});
