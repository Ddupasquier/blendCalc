import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260719222000_food_symbol_category_rules.sql",
	"utf8",
);
const hydrationMigration = readFileSync(
	"supabase/migrations/20260719225000_food_symbol_runtime_hydration.sql",
	"utf8",
);
const legacyBackfillMigration = readFileSync(
	"supabase/migrations/20260719225500_backfill_legacy_custom_food_symbols.sql",
	"utf8",
);
const foodSymbol = readFileSync(
	"src/lib/assets/icons/FoodSymbol.svelte",
	"utf8",
);
const referenceData = readFileSync(
	"src/lib/utils/food/reference/appReferenceData.ts",
	"utf8",
);

describe("food symbol reference catalog", () => {
	it("assigns category symbols through ordered database rules", () => {
		expect(migration).toContain("create table public.food_symbol_category_rules");
		expect(migration).toContain("resolve_food_symbol_key");
		expect(migration).toContain("set_custom_food_category_symbol_key");
	});

	it("backfills existing foods and keeps future writes synchronized", () => {
		expect(hydrationMigration).toContain(
			"resolve_food_symbol_key_for_food",
		);
		expect(hydrationMigration).toContain("update public.user_food_list_items");
		expect(hydrationMigration).toContain("update public.custom_foods");
		expect(hydrationMigration).toContain(
			"create or replace function public.sync_user_food_category_display",
		);
		expect(legacyBackfillMigration).toContain(
			"disable trigger prepare_custom_food_record",
		);
		expect(legacyBackfillMigration).toContain("update public.custom_foods");
	});

	it("loads DB rules and resolves missing stored keys without hardcoded keywords", () => {
		expect(referenceData).toContain('from("food_symbol_category_rules")');
		expect(foodSymbol).toContain("resolveFoodSymbolKey(food)");
		expect(foodSymbol).not.toContain("keywords");
		expect(foodSymbol).not.toMatch(/[🥤🍬🧈🥛🥩🐟🌾🌰🥬🍓📦🥣]/u);
	});
});
