import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260724154000_fix_compatibility_rule_regex_boundaries.sql",
	"utf8",
);

describe("food compatibility regex boundary migration", () => {
	it("translates JavaScript word boundaries for PostgreSQL matching", () => {
		expect(migration).toContain(
			"v_postgres_pattern := replace(p_pattern, '\\b', '\\y');",
		);
		expect(migration).toContain(
			"regexp_match(p_value, v_postgres_pattern, 'i')",
		);
	});

	it("reruns the canonical product fact backfill", () => {
		expect(migration).toContain(
			"select public.refresh_shared_product_compatibility_match_facts(product.id)",
		);
		expect(migration).toContain("where product.status = 'active'");
	});
});
