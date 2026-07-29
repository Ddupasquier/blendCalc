import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260729170000_versioned_regional_compatibility_feedback.sql",
	"utf8",
);

describe("versioned regional food compatibility policy migration", () => {
	it("captures immutable policy inputs and links generated facts", () => {
		expect(migration).toContain(
			"create table public.food_compatibility_policy_versions",
		);
		expect(migration).toContain("match_rule_snapshot jsonb not null");
		expect(migration).toContain("conflict_rule_snapshot jsonb not null");
		expect(migration).toContain(
			"add column policy_version_id uuid",
		);
		expect(migration).toContain("'policyVersion'");
	});

	it("records five reviewed official regional profiles", () => {
		for (const profileKey of [
			"us-fda",
			"ca-health-canada",
			"gb-fsa",
			"eu-1169-2011",
			"au-nz-fsanz",
		]) {
			expect(migration).toContain(`'${profileKey}'`);
		}
		expect(migration).toContain(
			"create table public.food_allergen_regulatory_profile_tags",
		);
	});

	it("keeps feedback ownership user-derived and moderation writes privileged", () => {
		expect(migration).toContain(
			"create table public.food_compatibility_feedback",
		);
		expect(migration).toContain(
			"Users can read their compatibility feedback",
		);
		expect(migration).toContain(
			"grant all on table public.food_compatibility_feedback",
		);
		expect(migration).not.toMatch(
			/grant (?:insert|update|delete).*food_compatibility_feedback\s+to authenticated/i,
		);
	});
});
