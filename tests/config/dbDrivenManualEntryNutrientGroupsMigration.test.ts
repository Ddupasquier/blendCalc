import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260719220000_db_driven_manual_entry_nutrient_groups.sql",
	"utf8",
);
const seeder = readFileSync("scripts/seeds/seed_manual_entry_nutrients.mjs", "utf8");
const nutrientDefinitions = readFileSync(
	"src/lib/utils/food/nutrients/nutrientDefinitions.ts",
	"utf8",
);

describe("DB-driven manual-entry nutrient groups", () => {
	it("stores versioned classifications and unresolved API observations in the database", () => {
		expect(migration).toContain("classification_status text not null default 'approved'");
		expect(migration).toContain("classification_version integer not null default 1");
		expect(migration).toContain("replacement_nutrient_id bigint references");
		expect(migration).toContain("canonical_nutrient_id bigint references");
		expect(migration).toContain("'unclassified-nutrients'");
		expect(migration).toContain("'unclassified'");
	});

	it("keeps common label values in Macros and moves specialized values to Extended", () => {
		expect(migration).toContain("'advanced-carbohydrate-details'");
		expect(migration).toContain("'advanced-fat-details'");
		expect(migration).toContain("'carotenoids', 'extended', 'Carotenoids'");
		expect(migration).toContain("where nutrient_id in (1082, 1084, 2038, 2065, 2033, 1086, 1009, 1071)");
		expect(migration).toContain("where nutrient_id in (1329, 1330, 1331)");
		expect(migration).toContain("where nutrient_id in (2028, 2029)");
		expect(migration).toContain("nutrient_type = 'carotenoid'");
		expect(migration).toContain("nutrient_type = 'proximate'");
		expect(migration).toContain("where id = 'mineral-details'");
		expect(migration).toContain("where nutrient_id in (1079, 2000, 1235)");
	});

	it("prevents API observations from overwriting approved UI policy", () => {
		const syncFunction = migration.slice(
			migration.indexOf("create or replace function public.sync_nutrient_manual_entry_fields()"),
			migration.indexOf("select public.sync_nutrient_manual_entry_fields();"),
		);
		expect(syncFunction).not.toContain("insert into public.nutrient_manual_entry_fields");
		expect(syncFunction).not.toContain("fields.group_id =");
		expect(syncFunction).toContain("fields.nutrient_id = counts.canonical_nutrient_id");
		expect(seeder).toContain("createManualEntryNutrientCatalog");
		expect(seeder).toContain("createSourceNutrientMappingCatalog");
		expect(seeder).not.toContain("OFF_NUTRIMENT_LOOKUP_KEYS");
		expect(nutrientDefinitions).toContain(
			'.eq("classification_status", "approved")',
		);
		expect(nutrientDefinitions).toContain('.eq("group_role", "display")');
	});

	it("pauses the legacy observation trigger while classifications are migrated", () => {
		expect(migration).toContain(
			"drop trigger if exists sync_nutrient_manual_entry_observations_after_change",
		);
		expect(migration).toContain(
			"create trigger sync_nutrient_manual_entry_observations_after_change",
		);
		expect(migration.indexOf("drop trigger if exists")).toBeLessThan(
			migration.indexOf("update public.nutrient_manual_entry_observations"),
		);
		expect(migration.indexOf("create trigger sync_nutrient_manual_entry_observations_after_change")).toBeGreaterThan(
			migration.indexOf("create or replace function public.sync_nutrient_manual_entry_fields()"),
		);
	});

	it("corrects specific Open Food Facts fat keys instead of mapping them to Total Fat", () => {
		expect(migration).toContain("when 'saturated-fat' then 1258");
		expect(migration).toContain("when 'trans-fat' then 1257");
		expect(migration).toContain("when 'polyunsaturated-fat' then 1293");
		expect(migration).toContain("when 'monounsaturated-fat' then 1292");
		expect(migration).toContain("db_reviewed_api_key_match");
	});
});
