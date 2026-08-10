import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260718193000_private_manual_nutrition_completeness.sql",
	"utf8",
);
const syncMigration = readFileSync(
	"supabase/migrations/20260718193500_sync_private_manual_nutrition_completeness.sql",
	"utf8",
);

describe("private manual nutrition completeness migration", () => {
	it("adds a dedicated database-backed manual food scope", () => {
		expect(migration).toContain(
			"food_scope in ('generic', 'manual', 'packaged')",
		);
		expect(migration).toContain("'private-manual-core-v1'");
		expect(migration).toContain("'Private manual-entry core nutrition'");
	});

	it("copies the current manual-entry requirements instead of duplicating them", () => {
		expect(migration).toContain(
			"from public.nutrient_manual_entry_required_nutrients required_nutrients",
		);
		expect(migration).toContain("where required_nutrients.enabled");
		expect(migration).toContain(
			"v_manual_profile_count <> v_manual_requirement_count",
		);
	});

	it("keeps the profile synchronized when manual requirements change", () => {
		expect(syncMigration).toContain(
			"create or replace function public.sync_private_manual_nutrition_completeness()",
		);
		expect(syncMigration).toContain(
			"after insert or update or delete on public.nutrient_manual_entry_required_nutrients",
		);
		expect(syncMigration).toContain(
			"for each statement execute function public.sync_private_manual_nutrition_completeness()",
		);
	});
});
