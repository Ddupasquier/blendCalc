import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
	"supabase/migrations/20260726150000_search_identity_preference_warnings.sql",
);
const migration = readFileSync(migrationPath, "utf8");

describe("search identity preference warning migration", () => {
	it("adds DB-backed inferred wheat and gluten identity rules", () => {
		expect(migration).toContain("add column exclude_pattern text");
		expect(migration).toContain("'wheat'");
		expect(migration).toContain("'gluten'");
		expect(migration).toContain("'source_food_identity'");
		expect(migration).toContain("'inferred'");
		expect(migration).toContain("bread|stuffing|ramen|noodles?");
	});

	it("suppresses contradicted matches and refreshes stored products", () => {
		expect(migration).toContain("rule.exclude_pattern is null");
		expect(migration).toContain("rule.exclude_pattern");
		expect(migration).toContain(
			"select public.refresh_shared_product_compatibility_match_facts(product.id)",
		);
	});
});
