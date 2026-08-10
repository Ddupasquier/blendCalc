import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260731130000_immutable_food_compatibility_policy_bundles.sql",
	"utf8",
);

describe("immutable food compatibility policy bundles migration", () => {
	it("binds every mutable policy rule family to a version", () => {
		for (const table of [
			"food_compatibility_policy_conflicts",
			"food_compatibility_policy_match_rules",
			"food_compatibility_policy_ingredient_aliases",
			"food_compatibility_policy_ingredient_relationships",
			"food_compatibility_policy_exemptions",
		]) {
			expect(migration).toContain(table);
		}
		expect(migration).toContain("policy_version_id uuid not null");
	});

	it("keeps runtime compatibility views limited to the active version", () => {
		expect(migration).toContain(
			"create view public.compatibility_rule_conflicts",
		);
		expect(migration).toContain(
			"create view public.food_compatibility_match_rules",
		);
		expect(migration).toContain(
			"public.active_food_compatibility_policy_version_id()",
		);
	});

	it("makes activated bundles immutable and refreshes facts atomically", () => {
		expect(migration).toContain(
			"enforce_food_compatibility_policy_child_immutability",
		);
		expect(migration).toContain(
			"activate_food_compatibility_policy_version",
		);
		expect(migration).toContain(
			"lock table public.food_compatibility_policy_versions in exclusive mode",
		);
		expect(migration).toContain(
			"perform public.extract_product_compatibility_facts",
		);
		expect(migration).toContain(
			"perform public.rebuild_food_preference_option_catalog()",
		);
		expect(migration).toContain(
			"v_prior_bundle_write := current_setting('blendcalc.policy_bundle_write', true)",
		);
		expect(migration).toContain("coalesce(v_prior_bundle_write, '')");
	});

	it("preserves rollback history and prevents broad exemption suppression", () => {
		expect(migration).toContain("status in ('draft', 'active', 'retired')");
		expect(migration).toContain("warning_behavior = 'context-only'");
		expect(migration).toContain("bundle_content_hash");
		expect(migration).toContain("status in ('draft', 'active', 'retired')");
	});
});
