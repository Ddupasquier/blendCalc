import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve("supabase/migrations/20260609045900_initial_user_data_tables.sql"),
	"utf8",
);

const userTables = [
	"user_food_list_items",
	"custom_foods",
	"saved_drinks",
	"mix_preferences",
];

describe("Supabase user data isolation", () => {
	it.each(userTables)("enables RLS on %s", (table) => {
		expect(migration).toContain(
			`alter table public.${table} enable row level security;`,
		);
	});

	it.each(userTables)("scopes %s policies to authenticated users", (table) => {
		const tablePolicyBlock = migration.slice(
			migration.indexOf(`on public.${table}`),
		);
		expect(tablePolicyBlock).toContain("to authenticated");
		expect(tablePolicyBlock).toContain("(select auth.uid())");
	});

	it("indexes every user_id policy column", () => {
		expect(migration).toContain("user_food_list_items (user_id, list_type)");
		expect(migration).toContain("custom_foods (user_id, created_at desc)");
		expect(migration).toContain("saved_drinks (user_id, created_at desc)");
		expect(migration).toContain(
			"user_id uuid primary key references auth.users(id)",
		);
	});
});
