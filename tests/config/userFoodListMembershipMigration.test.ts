import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260716120000_exclusive_user_food_list_membership.sql",
	"utf8",
).toLowerCase();

describe("exclusive user food list membership migration", () => {
	it("stores one canonical identity across fridge and shopping", () => {
		expect(migration).toContain("food_identity_key text");
		expect(migration).toContain("unique (user_id, food_identity_key)");
		expect(migration).toContain("partition by user_id, food_identity_key");
	});

	it("uses one database function to add or move a list item", () => {
		expect(migration).toContain("place_user_food_list_item");
		expect(migration).toContain("p_allow_move boolean default false");
		expect(migration).toContain("return 'move-required:'");
		expect(migration).toContain("return 'moved'");
	});
});
