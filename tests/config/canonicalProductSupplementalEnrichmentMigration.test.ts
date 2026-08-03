import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260802190000_canonical_product_supplemental_enrichment.sql",
	"utf8",
);

describe("canonical product supplemental enrichment migration", () => {
	it("fills only missing identity and precautionary fields", () => {
		expect(migration).toContain("'productName'");
		expect(migration).toContain("'brandOwner'");
		expect(migration).toContain("'precautionaryStatements'");
		expect(migration).toContain("nullif(btrim(v_product.brand_owner), '') is null");
		expect(migration).toContain(
			"jsonb_array_length(v_food -> 'precautionaryStatements') = 0",
		);
	});

	it("records reusable source evidence, provenance, and a revision", () => {
		expect(migration).toContain("canonical_storage_allowed");
		expect(migration).toContain("shared_product_observations");
		expect(migration).toContain("shared_product_field_provenance");
		expect(migration).toContain("canonical_provenance = v_canonical_provenance");
		expect(migration).toContain("shared_product_revisions");
	});

	it("keeps the enrichment write private to the service role", () => {
		expect(migration).toContain("security definer");
		expect(migration).toContain("from public, anon, authenticated");
		expect(migration).toContain("to service_role");
	});
});
