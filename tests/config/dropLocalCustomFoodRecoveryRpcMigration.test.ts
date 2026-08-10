import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260720143000_drop_local_custom_food_recovery_rpc.sql",
	"utf8",
);

describe("local custom-food recovery cleanup migration", () => {
	it("removes the obsolete browser-cache recovery function", () => {
		expect(migration).toContain(
			"drop function if exists public.save_custom_foods(jsonb)",
		);
	});
});
