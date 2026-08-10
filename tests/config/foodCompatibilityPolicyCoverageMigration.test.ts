import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve(
		"supabase/migrations/20260729160000_fix_food_compatibility_policy_coverage.sql",
	),
	"utf8",
);

describe("food compatibility policy coverage migration", () => {
	it("counts evidence reachable through preference conflict facts", () => {
		expect(migration).toContain(
			"conflict.preference_tag_id = tag.id",
		);
		expect(migration).toContain(
			"conflict.fact_tag_id = match_rule.tag_id",
		);
		expect(migration).toContain("match_rule.enabled");
	});

	it("keeps the coverage audit service-only", () => {
		expect(migration).toContain(
			"revoke all on public.food_compatibility_policy_coverage",
		);
		expect(migration).toContain(
			"grant select on public.food_compatibility_policy_coverage",
		);
		expect(migration).toContain("to service_role");
	});
});
