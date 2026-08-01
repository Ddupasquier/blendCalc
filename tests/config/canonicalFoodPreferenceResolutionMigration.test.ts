import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260731160000_canonical_food_preference_resolution.sql",
	"utf8",
);

describe("canonical food preference resolution migration", () => {
	it("stores reviewed mappings inside immutable policy versions", () => {
		expect(migration).toContain(
			"create table public.food_compatibility_policy_preference_term_mappings",
		);
		expect(migration).toContain("preference_mapping_snapshot");
		expect(migration).toContain(
			"enforce_food_compatibility_preference_term_mapping_immutability",
		);
	});

	it("keeps unmatched preferences unresolved and queues review safely", () => {
		expect(migration).toContain(
			"create table public.food_preference_mapping_requests",
		);
		expect(migration).toContain("'unresolved'");
		expect(migration).not.toContain("similarity(");
		expect(migration).not.toContain("levenshtein");
	});

	it("refreshes saved resolutions when a reviewed policy activates", () => {
		expect(migration).toContain(
			"create or replace function public.activate_food_preference_resolution_policy()",
		);
		expect(migration).toContain(
			"perform public.sync_user_compatibility_rules(",
		);
		expect(migration).toContain("from public.user_food_preferences preferences");
	});

	it("keeps reviewed resolution writes behind the service boundary", () => {
		expect(migration).toContain(
			"revoke insert, update, delete on table public.user_compatibility_rules",
		);
		expect(migration).toContain("from authenticated");
	});
});
