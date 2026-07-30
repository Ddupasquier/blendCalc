import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260729213000_evidence_based_catalog_field_provenance.sql",
	"utf8",
);
const categoryBackfill = readFileSync(
	"scripts/backfills/backfill_shared_product_categories.mjs",
	"utf8",
);

describe("evidence-based catalog field provenance", () => {
	it("removes selected category evidence derived from name-only matching", () => {
		expect(migration).toContain("'description-token-match'");
		expect(migration).toContain("set selected = false");
		expect(migration).toContain("category_option_id = null");
		expect(migration).toContain("'correctionReason'");
	});

	it("does not treat exact product identity as verification of every provider field", () => {
		expect(migration).toContain("set confidence = 'imported'");
		expect(migration).toContain(
			"observation.source in ('usda', 'open-food-facts')",
		);
		expect(migration).toContain("verification_method = 'exact-barcode'");
	});

	it("keeps category backfills limited to exact barcode observations", () => {
		expect(categoryBackfill).not.toContain("description-token-match");
		expect(categoryBackfill).not.toContain("lookupUsdaCategoriesByName");
		expect(categoryBackfill).toContain("normalizeBarcode(food.gtinUpc)");
	});
});
