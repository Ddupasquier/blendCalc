import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260805131000_remove_unit_only_mix_goals.sql",
	"utf8",
);

describe("unit-only Mix goal removal migration", () => {
	it("removes the obsolete unit-based runtime policy", () => {
		expect(migration).toContain(
			"delete from public.mix_runtime_configuration\nwhere key = 'default-goal-by-unit'",
		);
	});

	it("cleans only unsupported goals matching the former generated policy", () => {
		expect(migration).toContain("legacy_unit_only_mix_goals");
		expect(migration).toContain(
			"join public.mix_goal_template_targets target",
		);
		expect(migration).toContain("and template.is_default");
		expect(migration).toContain(
			"goal.source_template_version_id is null",
		);
		expect(migration).toContain("goal.source_user_template_id is null");
	});

	it("removes matching generated goals from saved Mix snapshots", () => {
		expect(migration).toContain("cleaned_saved_goals");
		expect(migration).toContain("'{nutrientGoals}'");
	});
});
