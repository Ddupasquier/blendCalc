import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260719221000_reference_catalog_integrity.sql",
	"utf8",
);

describe("reference catalog integrity migration", () => {
	it("only exposes enabled, approved source mappings", () => {
		expect(migration).toContain("review_status = 'approved'");
		expect(migration).toContain("where enabled and review_status = 'approved'");
		expect(migration).toContain("review_status = 'rejected'");
	});

	it("rejects unsafe parent-nutrient substitutions", () => {
		for (const sourceKey of [
			"beta-alanine",
			"energy-from-fat",
			"omega-3-fat",
			"omega-6-fat",
			"omega-9-fat",
		]) {
			expect(migration).toContain(`'${sourceKey}'`);
		}
		expect(migration).toContain(
			"Sub-nutrient or ratio fields must never substitute for a parent nutrient.",
		);
	});

	it("moves nutrient display policy and Mix defaults into versioned tables", () => {
		expect(migration).toContain("create table public.nutrient_display_profiles");
		expect(migration).toContain("create table public.nutrient_display_profile_fields");
		expect(migration).toContain("create table public.mix_goal_templates");
		expect(migration).toContain("create table public.mix_runtime_configuration");
	});
});
