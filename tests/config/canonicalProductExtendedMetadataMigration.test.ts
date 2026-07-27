import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260726201000_canonical_product_extended_metadata.sql",
	"utf8",
);

describe("canonical product extended metadata migration", () => {
	it("accepts every independently tracked package metadata field", () => {
		for (const field of [
			"structuredIngredients",
			"ingredientAnalysis",
			"additives",
			"package",
			"sourceMetadata",
		]) {
			expect(migration).toContain(`'${field}'`);
		}
	});

	it("only fills missing arrays and objects", () => {
		expect(migration).toContain(
			"jsonb_typeof(v_food -> v_field) is distinct from 'array'",
		);
		expect(migration).toContain(
			"jsonb_typeof(v_food -> v_key) is distinct from 'object'",
		);
		expect(migration).toContain("cardinality(v_applied_fields) = 0");
	});

	it("retains legal-source and provenance gates", () => {
		expect(migration).toContain("source.canonical_storage_allowed");
		expect(migration).toContain("source.canonical_license_name");
		expect(migration).toContain("shared_product_field_provenance");
		expect(migration).toContain("shared_product_observations");
		expect(migration).toContain("shared_product_revisions");
	});
});
