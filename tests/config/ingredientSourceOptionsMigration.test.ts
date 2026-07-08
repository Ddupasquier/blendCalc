import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260708163000_ingredient_source_options.sql",
	"utf8",
);

describe("ingredient source options migration", () => {
	it("stores source filter and badge labels in database config", () => {
		expect(migration).toContain("create table public.ingredient_source_options");
		expect(migration).toContain("value text primary key");
		expect(migration).toContain("filter_label text not null");
		expect(migration).toContain("badge_label text");
		expect(migration).toContain("display_order integer not null");
		expect(migration).toContain("insert into public.ingredient_source_options");
	});

	it("seeds the current app source states without putting labels in UI code", () => {
		expect(migration).toContain("'all'");
		expect(migration).toContain("'fdc'");
		expect(migration).toContain("'shared'");
		expect(migration).toContain("'custom'");
		expect(migration).toContain("'USDA FDC'");
		expect(migration).toContain("'Shared & verified'");
	});

	it("indexes filter and badge read paths", () => {
		expect(migration).toContain(
			"create unique index ingredient_source_options_display_order_idx",
		);
		expect(migration).toContain(
			"create index ingredient_source_options_filter_enabled_idx",
		);
		expect(migration).toContain(
			"create index ingredient_source_options_badge_enabled_idx",
		);
	});

	it("keeps source options read-only for authenticated users", () => {
		expect(migration).toContain(
			"alter table public.ingredient_source_options force row level security",
		);
		expect(migration).toContain(
			"Authenticated users can read ingredient source options",
		);
		expect(migration).toMatch(
			/revoke all on table public\.ingredient_source_options\s+from public, anon, authenticated/,
		);
		expect(migration).toContain(
			"grant select on table public.ingredient_source_options to authenticated",
		);
		expect(migration).toContain(
			"grant all on table public.ingredient_source_options to service_role",
		);
	});
});
