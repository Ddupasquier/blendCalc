import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve("supabase/migrations/20260719213000_versioned_product_label_updates.sql"),
	"utf8",
);

describe("versioned product label updates migration", () => {
	it("links an update to the canonical product and exact base revision", () => {
		expect(migration).toContain("submission_kind");
		expect(migration).toContain("target_shared_product_id");
		expect(migration).toContain("base_revision_id");
		expect(migration).toContain("label_observed_at");
		expect(migration).toContain("validate_shared_product_update_submission");
	});

	it("prevents a waiting review from overwriting a newer revision", () => {
		expect(migration).toContain("assert_shared_product_update_is_current");
		expect(migration).toContain(
			"Catalog update is stale because this product changed after submission",
		);
	});

	it("stores queryable before-and-after changes on the approved revision", () => {
		expect(migration).toContain("shared_product_revision_changes");
		expect(migration).toContain("supersedes_revision_id");
		expect(migration).toContain("record_shared_product_revision_changes");
		expect(migration).toContain("previous_value");
		expect(migration).toContain("new_value");
		expect(migration).toContain("submission.status = 'pending'");
	});

	it("keeps internal change history outside direct client access", () => {
		expect(migration).toContain(
			"alter table public.shared_product_revision_changes force row level security",
		);
		expect(migration).toContain(
			"revoke all on table public.shared_product_revision_changes from public, anon, authenticated",
		);
	});
});
