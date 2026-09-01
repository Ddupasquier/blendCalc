import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve(
		"supabase/migrations/20260901060000_immutable_catalog_update_proposals.sql",
	),
	"utf8",
);

describe("immutable catalog update proposals migration", () => {
	it("locks the proposed identity, snapshot, evidence, and explicit differences", () => {
		expect(migration).toContain("preserve_shared_product_update_proposal");
		expect(migration).toContain(
			"old.base_revision_id is distinct from new.base_revision_id",
		);
		expect(migration).toContain("old.food is distinct from new.food");
		expect(migration).toContain(
			"old.change_summary is distinct from new.change_summary",
		);
		expect(migration).toContain(
			"old.evidence_paths is distinct from new.evidence_paths",
		);
	});

	it("prevents deletion without blocking review workflow metadata", () => {
		expect(migration).toContain("before update or delete");
		expect(migration).toContain("Catalog update proposals are immutable");
		expect(migration).not.toContain("old.status is distinct from new.status");
		expect(migration).not.toContain(
			"old.reviewed_by is distinct from new.reviewed_by",
		);
	});
});
