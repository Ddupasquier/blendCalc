import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260729214000_repair_catalog_provenance_snapshots.sql",
	"utf8",
);

describe("catalog provenance snapshot repair", () => {
	it("rebuilds compatibility snapshots only from selected field evidence", () => {
		expect(migration).toContain("where provenance.selected");
		expect(migration).toContain("'source', selected.source");
		expect(migration).toContain("'observationId', selected.observation_id");
		expect(migration).toContain("canonical_provenance = field_patches.canonical_patch");
	});
});
