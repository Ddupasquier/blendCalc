import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260627170000_nutrient_definition_manual_entry_groups.sql",
	"utf8",
);

describe("manual entry nutrient group migration", () => {
	it("keeps manual entry nutrient UI metadata normalized", () => {
		expect(migration).toContain(
			"if to_regclass('public.nutrient_manual_entry_observations') is not null then",
		);
		expect(migration).toContain("create table public.nutrient_manual_entry_groups");
		expect(migration).toContain("create table public.nutrient_manual_entry_fields");
		expect(migration).toContain("create table public.nutrient_manual_entry_observations");
		expect(migration).toContain(
			"group_id text not null references public.nutrient_manual_entry_groups(id)",
		);
		expect(migration).toContain("verification_status text not null default 'single_source'");
		expect(migration).not.toContain("entry_group text not null");
	});

	it("links manual entry fields to canonical nutrient definitions", () => {
		expect(migration).toContain(
			"dedupe_key text primary key check (btrim(dedupe_key) <> '')",
		);
		expect(migration).toContain(
			"nutrient_id bigint not null references public.nutrient_definitions(nutrient_id)",
		);
		expect(migration).toContain("insert into public.nutrient_manual_entry_groups");
		expect(migration).toContain("insert into public.nutrient_manual_entry_fields");
		expect(migration).toContain("select distinct on (dedupe_key)");
		expect(migration).toContain("'amino_acid', 'other'");
		expect(migration).toContain("when observation_counts.source_count > 1 then 'multi_source_verified'");
	});

	it("protects manual entry lookup tables with read-only RLS", () => {
		expect(migration).toContain(
			"alter table public.nutrient_manual_entry_groups enable row level security",
		);
		expect(migration).toContain(
			"alter table public.nutrient_manual_entry_fields enable row level security",
		);
		expect(migration).toContain(
			"grant select on table public.nutrient_manual_entry_groups to authenticated",
		);
		expect(migration).toContain(
			"grant select on table public.nutrient_manual_entry_fields to authenticated",
		);
	});
});
