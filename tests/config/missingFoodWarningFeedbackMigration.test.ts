import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260731163000_missing_food_warning_feedback.sql",
	"utf8",
);

describe("missing food warning feedback migration", () => {
	it("extends the existing private moderation queue", () => {
		expect(migration).toContain("feedback_type");
		expect(migration).toContain("'missing_warning'");
		expect(migration).not.toContain("create table public.missing");
	});

	it("retains the affected preference, policy evidence, and catalog revision", () => {
		expect(migration).toContain("preference_tag_id");
		expect(migration).toContain("shared_product_revision_id");
		expect(migration).toContain("observed_label_date");
	});

	it("keeps evidence private and structurally paired", () => {
		expect(migration).toContain("evidence_path");
		expect(migration).toContain("evidence_sha256");
		expect(migration).toContain("split_part(evidence_path, '/', 1) = reported_by::text");
	});
});
