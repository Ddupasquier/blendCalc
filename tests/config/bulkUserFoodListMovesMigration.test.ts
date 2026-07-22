import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260722120000_bulk_user_food_list_moves.sql",
	"utf8",
);

describe("bulk user-food list moves migration", () => {
	it("moves one authenticated selection in a single database function", () => {
		expect(migration).toContain("function public.move_user_food_list_items");
		expect(migration).toContain("v_user_id uuid := auth.uid()");
		expect(migration).toContain("update public.user_food_list_items");
		expect(migration).toContain("set list_type = p_target_list_type");
	});

	it("locks and validates the complete selection before updating", () => {
		expect(migration).toContain("for update");
		expect(migration).toContain("v_available_count <> v_requested_count");
		expect(migration).toContain(
			"One or more selected ingredients are no longer in the source list.",
		);
	});
});
