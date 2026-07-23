import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260722221000_private_custom_food_classification.sql",
	"utf8",
).toLowerCase();

describe("private custom food classification migration", () => {
	it("allows personal source-backed foods without labeling them custom", () => {
		expect(migration).toContain(
			"if jsonb_typeof(v_food -> 'customfood') <> 'boolean'",
		);
		expect(migration).not.toContain(
			"only custom foods can be saved through this path",
		);
	});

	it("limits private custom status to unlinked custom or unknown records", () => {
		expect(migration).toContain(
			"public.food_source_key(p_food) in ('custom', 'unknown')",
		);
		expect(migration).toContain(
			"and v_shared_product_id is null",
		);
		expect(migration).toContain(
			"and v_pending_submission_id is null",
		);
	});

	it("backfills catalog matches, pending submissions, and list projections", () => {
		expect(migration).toContain("from public.shared_products shared_product");
		expect(migration).toContain(
			"from public.shared_product_submissions submission",
		);
		expect(migration).toContain("update public.user_food_list_items");
	});
});
