import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260627172000_custom_food_category_options.sql",
	"utf8",
);

describe("custom food category options migration", () => {
	it("stores API-observed manual-entry category options in lookup tables", () => {
		expect(migration).toContain("create table public.custom_food_category_options");
		expect(migration).toContain(
			"create table public.custom_food_category_observations",
		);
		expect(migration).toContain("observation_count integer not null default 0");
		expect(migration).toContain("verification_status text not null default 'single_source'");
		expect(migration).toContain("source_payload jsonb not null default '{}'::jsonb");
		expect(migration).toContain("'fdc-branded-detail'");
		expect(migration).not.toMatch(
			/insert into public\.custom_food_category_options[\s\S]*values/i,
		);
	});

	it("rebuilds category options from stored source observations", () => {
		expect(migration).toContain(
			"create or replace function public.rebuild_custom_food_category_options()",
		);
		expect(migration).toContain("from public.custom_food_category_observations observation");
		expect(migration).toContain("when count(distinct observation.source) > 1 then 'multi_source_verified'");
		expect(migration).toContain(
			"grant execute on function public.rebuild_custom_food_category_options()",
		);
	});

	it("keeps category options read-only for authenticated clients", () => {
		expect(migration).toContain(
			"alter table public.custom_food_category_options enable row level security",
		);
		expect(migration).toContain(
			"grant select on table public.custom_food_category_options to authenticated",
		);
		expect(migration).toContain(
			"grant select on table public.custom_food_category_observations to authenticated",
		);
		expect(migration).toMatch(
			/revoke all on table public\.custom_food_category_options\s+from public, anon, authenticated/,
		);
		expect(migration).toMatch(
			/revoke all on table public\.custom_food_category_observations\s+from public, anon, authenticated/,
		);
	});

	it("indexes enabled options by label for database-backed alphabetical sorting", () => {
		expect(migration).toContain("create index custom_food_category_options_label_idx");
		expect(migration).toContain("enabled,\n\t\tlabel asc");
		expect(migration).not.toContain("custom_food_category_options_rank_idx");
	});
});
