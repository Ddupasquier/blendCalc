import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve(
		"supabase/migrations/20260730170000_field_safe_catalog_corrections.sql",
	),
	"utf8",
);

describe("field-safe catalog correction migration", () => {
	it("stores explicit correction intent", () => {
		expect(migration).toContain("submission_intent");
		expect(migration).toContain("'catalog_correction'");
		expect(migration).toContain("'catalog_share'");
	});

	it("allows independent correction evidence against the same revision", () => {
		expect(migration).toContain(
			"shared_product_submissions_user_pending_update_unique",
		);
		expect(migration).toContain("submitted_by");
		expect(migration).toContain("base_revision_id");
		expect(migration).not.toContain(
			"create unique index shared_product_submissions_pending_update_unique",
		);
	});

	it("preserves unchanged provenance and whole-product source identity", () => {
		expect(migration).toContain(
			"when v_submission.submission_kind = 'product_update'",
		);
		expect(migration).toContain("then shared_products.source");
		expect(migration).toContain(
			"select coalesce(canonical_provenance, '{}'::jsonb)",
		);
		expect(migration).toContain(
			"select value ->> 'fieldPath'",
		);
	});
});
