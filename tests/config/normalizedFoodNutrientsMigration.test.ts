import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath =
	"supabase/migrations/20260615010000_normalized_food_nutrients.sql";
const migration = readFileSync(migrationPath, "utf8");

describe("normalized food nutrient migration", () => {
	it("keeps a constrained nutrient dictionary and query table", () => {
		expect(migration).toContain("create table public.nutrient_definitions");
		expect(migration).toContain("create table public.food_nutrients");
		expect(migration).toContain("food_nutrients_exactly_one_parent");
		expect(migration).toContain("amount_per_100g numeric not null");
	});

	it("preserves reported versus derived values and provenance", () => {
		expect(migration).toContain("reportedNutrientIds");
		expect(migration).toContain("then 'derived'");
		expect(migration).toContain("source_observation_id uuid references");
		expect(migration).toContain("shared_product_field_provenance provenance");
	});

	it("synchronizes every persisted food snapshot", () => {
		for (const trigger of [
			"sync_user_food_list_item_nutrients",
			"sync_custom_food_nutrients",
			"sync_shared_product_submission_nutrients",
			"sync_shared_product_nutrients",
			"sync_shared_product_revision_nutrients",
			"sync_shared_product_observation_nutrients",
		]) {
			expect(migration).toContain(`create trigger ${trigger}`);
		}

		expect(migration).toContain("select public.replace_food_nutrients(");
	});

	it("uses RLS and prevents direct browser writes", () => {
		expect(migration).toContain(
			"alter table public.food_nutrients force row level security",
		);
		expect(migration).toContain(
			"Users can read accessible normalized nutrients",
		);
		expect(migration).toContain(
			"revoke all on table public.food_nutrients from public, anon, authenticated",
		);
		expect(migration).toContain(
			"grant select on table public.food_nutrients to authenticated",
		);
	});

	it("indexes user and shared nutrient-range queries", () => {
		expect(migration).toContain("food_nutrients_owner_nutrient_amount_idx");
		expect(migration).toContain("food_nutrients_shared_nutrient_amount_idx");
	});
});
