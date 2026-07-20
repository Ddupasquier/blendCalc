import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260719230000_remove_provider_verification_fallbacks.sql",
	"utf8",
);

describe("provider verification fallback correction", () => {
	it("removes blanket verification from Open Food Facts records", () => {
		expect(migration).toContain("product.source = 'open-food-facts'");
		expect(migration).toContain("confidence = 'imported'");
		expect(migration).toContain("confidence = 'unknown'");
		expect(migration).toContain("source = 'open-food-facts'");
	});

	it("preserves products with independent verification evidence", () => {
		expect(migration).toContain("verification_method in");
		expect(migration).toContain("'exact-barcode'");
		expect(migration).toContain("'cross-source'");
		expect(migration).toContain("'moderator-review'");
	});

	it("refreshes saved-list projections after correcting catalog confidence", () => {
		expect(migration).toContain("update public.user_food_list_items");
		expect(migration).toContain("set food = food");
	});
});
