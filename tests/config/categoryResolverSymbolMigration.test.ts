import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260719224000_category_resolver_symbol.sql",
	"utf8",
);

describe("category resolver symbol migration", () => {
	it("returns the category and symbol in one database call", () => {
		expect(migration).toContain(
			"resolve_custom_food_category_option_with_symbol",
		);
		expect(migration).toContain("symbol_key text");
		expect(migration).toContain("candidate.symbol_key");
	});
});
