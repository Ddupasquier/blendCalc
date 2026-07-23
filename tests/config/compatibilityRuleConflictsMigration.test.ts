import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve(
		"supabase/migrations/20260723120000_compatibility_rule_conflicts.sql",
	),
	"utf8",
);

describe("compatibility rule conflict migration", () => {
	it("stores DB-driven preference-to-product fact relationships", () => {
		expect(migration).toContain(
			"create table public.compatibility_rule_conflicts",
		);
		expect(migration).toContain(
			"primary key (preference_tag_id, fact_tag_id)",
		);
		expect(migration).toContain("('vegan', 'milk', 'warning')");
	});

	it("keeps the conflict catalog read-only for app users", () => {
		expect(migration).toContain(
			"alter table public.compatibility_rule_conflicts force row level security",
		);
		expect(migration).toContain(
			"grant select on table public.compatibility_rule_conflicts to authenticated, service_role",
		);
	});
});
