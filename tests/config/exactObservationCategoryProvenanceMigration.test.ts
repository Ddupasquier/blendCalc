import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260726225900_backfill_exact_observation_category_provenance.sql",
	"utf8",
);

describe("exact observation category provenance migration", () => {
	it("requires the product's exact source observation", () => {
		expect(migration).toContain("observation.source = product.source");
		expect(migration).toContain(
			"observation.source_reference is not distinct from product.source_reference",
		);
	});

	it("requires the source category to equal the canonical category", () => {
		expect(migration).toContain(
			"lower(btrim(observation.normalized_food ->> 'foodCategory'))",
		);
		expect(migration).toContain("lower(btrim(category.label))");
	});

	it("requires canonical and API redistribution approval", () => {
		expect(migration).toContain("source.canonical_storage_allowed");
		expect(migration).toContain("source.api_redistribution_allowed");
	});

	it("records source lineage and a revision", () => {
		expect(migration).toContain("'categories'");
		expect(migration).toContain("'exact-barcode'");
		expect(migration).toContain(
			"insert into public.shared_product_revisions",
		);
	});
});
