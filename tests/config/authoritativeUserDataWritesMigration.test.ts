import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260720150000_authoritative_user_data_writes.sql",
	"utf8",
);

describe("authoritative user-data writes migration", () => {
	it("derives ownership from the authenticated database session", () => {
		expect(migration).toContain("v_user_id uuid := auth.uid()");
		expect(migration).not.toContain("p_user_id");
	});

	it("provides one database function for each durable write flow", () => {
		for (const functionName of [
			"place_user_food_list_items",
			"rename_user_food_list_item",
			"remove_user_food_list_item",
			"save_saved_drink",
			"delete_saved_drink",
			"save_mix_preferences",
		]) {
			expect(migration).toContain(`function public.${functionName}`);
		}
	});

	it("prevents authenticated clients from bypassing the functions", () => {
		expect(migration).toContain(
			"revoke insert, update, delete on table public.user_food_list_items from authenticated",
		);
		expect(migration).toContain(
			"revoke insert, update, delete on table public.saved_drinks from authenticated",
		);
		expect(migration).toContain(
			"revoke insert, update, delete on table public.mix_preferences from authenticated",
		);
	});
});
