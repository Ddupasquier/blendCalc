import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260729215000_separate_catalog_identity_from_field_verification.sql",
	"utf8",
);

describe("catalog identity verification migration", () => {
	it("separates exact product identity from field verification", () => {
		expect(migration).toContain("verification_status = 'exact_identity'");
		expect(migration).toContain("verification_status in (");
		expect(migration).toContain("'exact_identity'");
		expect(migration).toContain(
			"Field verification remains in shared_product_field_provenance",
		);
	});

	it("downgrades provider-derived whole-product confidence without changing field evidence", () => {
		expect(migration).toContain("set confidence = 'imported'");
		expect(migration).toContain(
			"and source in ('usda', 'open-food-facts')",
		);
		expect(migration).not.toContain(
			"update public.shared_product_field_provenance",
		);
	});

	it("keeps the legacy publishing RPC from reintroducing the old workflow label", () => {
		expect(migration).toContain(
			"create or replace function public.normalize_shared_product_submission_verification()",
		);
		expect(migration).toContain(
			"if new.verification_status = 'source_verified' then",
		);
	});
});
