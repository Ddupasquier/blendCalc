import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260722163500_manual_entry_observation_bulk_sync.sql",
	"utf8",
);
const seeder = readFileSync(
	"scripts/seeds/seed_manual_entry_nutrients.mjs",
	"utf8",
);

describe("manual-entry observation bulk synchronization", () => {
	it("removes the full-catalog rescan from every observation batch", () => {
		expect(migration).toContain(
			"drop trigger if exists sync_nutrient_manual_entry_observations_after_change",
		);
		expect(migration).toContain("per-statement synchronization is intentionally disabled");
	});

	it("performs one explicit summary sync after idempotent observation batches", () => {
		expect(seeder).toContain("ignoreDuplicates: true");
		expect(seeder).toContain('supabase.rpc("sync_nutrient_manual_entry_fields")');
		expect(seeder.indexOf("ignoreDuplicates: true")).toBeLessThan(
			seeder.indexOf('supabase.rpc("sync_nutrient_manual_entry_fields")'),
		);
	});
});
