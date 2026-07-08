import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260708120000_custom_food_category_mappings.sql",
	"utf8",
);

describe("custom food category mappings migration", () => {
	it("stores API-observed source category mappings to app category options", () => {
		expect(migration).toContain("create table public.custom_food_category_mappings");
		expect(migration).toContain(
			"source_normalized_value text primary key",
		);
		expect(migration).toContain(
			"category_option_id text not null references public.custom_food_category_options",
		);
		expect(migration).toContain("source_values text[] not null default");
		expect(migration).toContain("source_fields text[] not null default");
		expect(migration).toContain("sources text[] not null default");
		expect(migration).not.toMatch(/insert into public\.custom_food_category_mappings/i);
	});

	it("indexes lookup and moderation review paths", () => {
		expect(migration).toContain(
			"create index custom_food_category_mappings_option_idx",
		);
		expect(migration).toContain(
			"create index custom_food_category_mappings_confidence_idx",
		);
	});

	it("keeps mappings read-only for authenticated users and writable by service role", () => {
		expect(migration).toContain(
			"alter table public.custom_food_category_mappings force row level security",
		);
		expect(migration).toContain(
			"Authenticated users can read custom food category mappings",
		);
		expect(migration).toMatch(
			/revoke all on table public\.custom_food_category_mappings\s+from public, anon, authenticated/,
		);
		expect(migration).toContain(
			"grant select on table public.custom_food_category_mappings to authenticated",
		);
		expect(migration).toContain(
			"grant all on table public.custom_food_category_mappings to service_role",
		);
	});
});
