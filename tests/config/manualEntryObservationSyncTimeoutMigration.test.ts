import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260722164000_manual_entry_observation_sync_timeout.sql",
	"utf8",
);

describe("manual-entry observation summary timeout", () => {
	it("gives the maintenance-only full-catalog aggregation a bounded extended timeout", () => {
		expect(migration).toContain(
			"alter function public.sync_nutrient_manual_entry_fields()",
		);
		expect(migration).toContain("set statement_timeout = '60s'");
		expect(migration).toContain("interactive requests must not call it");
	});
});
