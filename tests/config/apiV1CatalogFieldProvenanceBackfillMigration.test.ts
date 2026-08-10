import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260726225800_backfill_api_v1_catalog_field_provenance.sql",
	"utf8",
);

describe("API v1 catalog field provenance backfill migration", () => {
	it("requires exact product-source ingredient evidence", () => {
		expect(migration).toContain("observation.source = product.source");
		expect(migration).toContain(
			"observation.source_reference is not distinct from product.source_reference",
		);
		expect(migration).toContain(
			"lower(btrim(product.food ->> 'ingredients'))",
		);
	});

	it("requires exact canonical category mappings", () => {
		expect(migration).toContain(
			"category_mapping.confidence = 'exact'",
		);
		expect(migration).toContain(
			"category_mapping.category_option_id = product.category_option_id",
		);
	});

	it("only publishes data from reviewed redistributable sources", () => {
		expect(migration).toContain("source.canonical_storage_allowed");
		expect(migration).toContain("source.api_redistribution_allowed");
		expect(migration).not.toContain("open-food-facts");
	});

	it("records selected provenance and a revision", () => {
		expect(migration).toContain(
			"insert into public.shared_product_field_provenance",
		);
		expect(migration).toContain(
			"insert into public.shared_product_revisions",
		);
		expect(migration).toContain("'exact-barcode'");
	});
});
