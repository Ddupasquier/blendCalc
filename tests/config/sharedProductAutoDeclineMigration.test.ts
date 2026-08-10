import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve("supabase/migrations/20260706011500_shared_product_auto_decline_status.sql"),
	"utf8",
);

describe("shared product auto-decline migration", () => {
	it("adds a non-moderation status for machine-blocked catalog submissions", () => {
		expect(migration).toContain("'auto_declined'");
		expect(migration).toContain("shared_product_submissions_status_check");
	});

	it("indexes auto-declined rows for barcode audit lookups", () => {
		expect(migration).toContain(
			"shared_product_submissions_auto_declined_barcode_created_idx",
		);
		expect(migration).toContain("where status = 'auto_declined'");
		expect(migration).toContain("barcode, created_at desc");
	});
});
