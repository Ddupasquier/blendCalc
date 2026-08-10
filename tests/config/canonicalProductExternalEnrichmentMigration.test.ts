import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260719210000_canonical_product_external_enrichment.sql",
	"utf8",
);

describe("canonical product external enrichment migration", () => {
	it("locks the canonical product and only fills missing tracked fields", () => {
		expect(migration).toContain("for update");
		expect(migration).toContain("status = 'active'");
		expect(migration).toContain("jsonb_array_length(v_food -> 'foodNutrients') = 0");
		expect(migration).toContain("v_product.category_option_id is null");
		expect(migration).toContain("nullif(btrim(v_food -> 'image' ->> 'imageUrl'), '') is null");
		expect(migration).toContain("coalesce(v_food ->> 'hasSourceServing', 'false') <> 'true'");
	});

	it("records source evidence, selected field provenance, and a revision", () => {
		expect(migration).toContain("shared_product_observations");
		expect(migration).toContain("shared_product_field_provenance");
		expect(migration).toContain("canonical_provenance = v_canonical_provenance");
		expect(migration).toContain("shared_product_revisions");
	});

	it("keeps automatic writes private to trusted server code", () => {
		expect(migration).toContain("canonical_storage_allowed");
		expect(migration).toContain("canonical_license_name");
		expect(migration).toContain("public.product_data_sources source");
		expect(migration).toContain("security definer");
		expect(migration).toContain("from public, anon, authenticated");
		expect(migration).toContain("to service_role");
	});
});
