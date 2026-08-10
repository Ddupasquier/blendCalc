import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260801230000_reviewed_preserves_category_provenance.sql",
	"utf8",
);

describe("reviewed preserves category provenance migration", () => {
	it("maps the exact USDA category into the canonical category", () => {
		expect(migration).toContain("source_normalized_value = 'jam jelly and fruit spreads'");
		expect(migration).toContain("category_option_id = 'jams'");
		expect(migration).toContain("match_reason = 'reviewed_canonical_mapping'");
	});

	it("requires the exact product source reference and redistribution policy", () => {
		expect(migration).toContain(
			"category_observation.source_reference = product.source_reference",
		);
		expect(migration).toContain("source.canonical_storage_allowed");
		expect(migration).toContain("source.api_redistribution_allowed");
	});

	it("records imported field evidence without blanket verification", () => {
		expect(migration).toContain("'categories'");
		expect(migration).toContain("'imported'");
		expect(migration).toContain("'exact-barcode'");
		expect(migration).not.toContain("'source-verified'");
	});

	it("creates a revision for the selected provenance repair", () => {
		expect(migration).toContain("insert into public.shared_product_revisions");
		expect(migration).toContain("'provenanceBackfill'");
	});
});

