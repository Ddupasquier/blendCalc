import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260726200000_authoritative_generic_food_metadata.sql",
	"utf8",
);

describe("authoritative generic food metadata migration", () => {
	it("keeps generic identity distinct from packaged title inference", () => {
		expect(migration).toContain("'generic_food_identity'");
		expect(migration).toContain("'food_identity_taxonomy'");
		expect(migration).toContain("'foodIdentityType' = 'generic'");
		expect(migration).toContain("'contains'");
		expect(migration).not.toContain("'source_food_identity'");
	});

	it("covers the regulated major allergen groups from DB-backed rules", () => {
		for (const slug of [
			"milk",
			"peanut",
			"tree-nut",
			"soy",
			"egg",
			"wheat",
			"fish",
			"shellfish",
			"sesame",
		]) {
			expect(migration).toContain(`'${slug}'`);
		}
	});

	it("backfills existing canonical compatibility facts", () => {
		expect(migration).toContain(
			"select public.refresh_shared_product_compatibility_match_facts(product.id)",
		);
		expect(migration).toContain("where product.status = 'active'");
	});

	it("preserves grandfathered custom foods during the metadata-only backfill", () => {
		expect(migration).toContain(
			"disable trigger prepare_custom_food_record",
		);
		expect(migration).toContain(
			"enable trigger prepare_custom_food_record",
		);
	});

	it("returns preserved generic-food identity metadata", () => {
		expect(migration).toContain("alternate_description text");
		expect(migration).toContain("scientific_name text");
		expect(migration).toContain("preparation text");
	});
});
