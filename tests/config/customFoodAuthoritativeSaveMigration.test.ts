import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260717170000_authoritative_custom_food_saves.sql",
	"utf8",
).toLowerCase();
const gtinLintFixMigration = readFileSync(
	"supabase/migrations/20260717171000_fix_gtin_lint_warning.sql",
	"utf8",
).toLowerCase();

describe("authoritative custom-food save migration", () => {
	it("routes authenticated writes through secured database functions", () => {
		expect(migration).toContain("create or replace function public.save_custom_food(");
		expect(migration).toContain("v_user_id uuid := auth.uid()");
		expect(migration).toContain("security definer");
		expect(migration).toContain("revoke insert, update on table public.custom_foods from authenticated");
		expect(migration).toContain("grant execute on function public.save_custom_food(bigint, jsonb) to authenticated");
	});

	it("enforces database-backed category and nutrition rules", () => {
		expect(migration).toContain("references public.custom_food_category_options(id)");
		expect(migration).toContain("public.nutrient_manual_entry_required_nutrients");
		expect(migration).toContain("public.nutrient_relationship_rules");
		expect(migration).toContain("public.nutrient_definitions");
		expect(migration).toContain("create trigger prepare_custom_food_record");
	});

	it("validates and normalizes GTIN barcodes in the database", () => {
		expect(migration).toContain("create or replace function public.is_valid_gtin");
		expect(gtinLintFixMigration).toContain("for v_position in 1..(v_length - 1)");
		expect(migration).toContain("lpad(v_raw_barcode, 14, '0')");
		expect(migration).toContain("duplicate-barcode");
		expect(migration).toContain("duplicate-name");
	});
});
