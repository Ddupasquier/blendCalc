import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve("supabase/migrations/20260618193000_product_compatibility.sql"),
	"utf8",
);

describe("product compatibility migration", () => {
	it("creates canonical tags, facts, and user rules", () => {
		expect(migration).toContain("create table public.compatibility_tags");
		expect(migration).toContain("create table public.user_compatibility_rules");
		expect(migration).toContain("create table public.product_compatibility_facts");
		expect(migration).not.toContain("'ingredient_parse'");
	});

	it("adds cached compatibility summaries to shared products", () => {
		expect(migration).toContain(
			"add column if not exists compatibility_summary jsonb not null default '{}'::jsonb",
		);
		expect(migration).toContain(
			"create or replace function public.rebuild_shared_product_compatibility_summary",
		);
	});

	it("keeps product compatibility data synchronized from shared catalog food", () => {
		expect(migration).toContain(
			"create trigger sync_shared_product_compatibility_from_food",
		);
		expect(migration).toContain(
			"create trigger sync_shared_product_observation_compatibility_from_food",
		);
		expect(migration).toContain(
			"create trigger sync_shared_product_submission_compatibility_from_food",
		);
		expect(migration).toContain(
			"select public.extract_product_compatibility_facts(",
		);
	});

	it("backfills user rules from saved food preferences", () => {
		expect(migration).toContain(
			"select public.sync_user_compatibility_rules(",
		);
		expect(migration).toContain("from public.user_food_preferences preferences;");
	});

	it("uses RLS and restricts writes on shared product facts", () => {
		expect(migration).toContain(
			"alter table public.product_compatibility_facts force row level security;",
		);
		expect(migration).toContain(
			"Authenticated users can read shared product compatibility facts",
		);
		expect(migration).toContain(
			"grant select on table public.product_compatibility_facts to authenticated;",
		);
	});
});
