import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve("supabase/migrations/20260629210000_manual_entry_required_nutrients.sql"),
	"utf8",
);

describe("manual entry required nutrients migration", () => {
	it("stores required manual-entry nutrients in the database", () => {
		expect(migration).toContain(
			"add column if not exists required_for_manual_entry boolean not null default false",
		);
		expect(migration).toContain(
			"create table if not exists public.nutrient_manual_entry_required_nutrients",
		);
		expect(migration).toContain("'sodium', '307'");
		expect(migration).toContain("'required-basics'");
	});

	it("keeps required flags synchronized onto renderable nutrient fields", () => {
		expect(migration).toContain(
			"create or replace function public.set_nutrient_manual_entry_field_required_flag()",
		);
		expect(migration).toContain(
			"create trigger set_nutrient_manual_entry_field_required_flag",
		);
		expect(migration).toContain(
			"create or replace function public.refresh_nutrient_manual_entry_required_flags()",
		);
		expect(migration).toContain("required_for_manual_entry = true");
	});

	it("uses RLS and read-only authenticated access", () => {
		expect(migration).toContain(
			"alter table public.nutrient_manual_entry_required_nutrients force row level security;",
		);
		expect(migration).toContain(
			"Authenticated users can read manual entry required nutrients",
		);
		expect(migration).toContain(
			"grant select on table public.nutrient_manual_entry_required_nutrients to authenticated;",
		);
		expect(migration).toContain(
			"grant all on table public.nutrient_manual_entry_required_nutrients to service_role;",
		);
	});
});
