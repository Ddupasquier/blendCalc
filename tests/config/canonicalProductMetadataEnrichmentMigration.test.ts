import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260724150000_canonical_product_metadata_enrichment.sql",
	"utf8",
);

describe("canonical product metadata enrichment migration", () => {
	it("accepts every source-backed product metadata field", () => {
		for (const field of [
			"ingredients",
			"allergens",
			"traces",
			"dietaryTags",
			"labels",
		]) {
			expect(migration).toContain(`'${field}'`);
		}
	});

	it("only fills missing canonical values", () => {
		expect(migration).toContain(
			"nullif(btrim(v_food ->> 'ingredients'), '') is null",
		);
		expect(migration).toContain(
			"jsonb_array_length(v_food -> 'ingredientList') = 0",
		);
		expect(migration).toContain(
			"jsonb_array_length(v_food -> v_field) = 0",
		);
	});

	it("retains the legal-source, evidence, and revision safeguards", () => {
		expect(migration).toContain("source.canonical_storage_allowed");
		expect(migration).toContain("source.canonical_license_name");
		expect(migration).toContain("shared_product_observations");
		expect(migration).toContain("shared_product_field_provenance");
		expect(migration).toContain("shared_product_revisions");
		expect(migration).toContain("to service_role");
	});
});
