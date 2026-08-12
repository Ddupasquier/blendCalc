import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260812100000_preserve_api_v1_attribution_metadata.sql",
	"utf8",
);

describe("API v1 attribution metadata migration", () => {
	it("requires complete reviewed provider attribution", () => {
		for (const requirement of [
			"source.enabled",
			"source.canonical_storage_allowed",
			"source.api_redistribution_allowed",
			"source.canonical_policy_reviewed_at is not null",
			"source.display_name",
			"source.homepage_url",
			"source.canonical_license_name",
			"source.terms_url",
			"source.attribution_text",
		]) {
			expect(migration).toContain(requirement);
		}
	});

	it("requires exact active dataset-release attribution and an import date", () => {
		expect(migration).toContain("split_part(btrim(p_source_reference), ':', 1)");
		expect(migration).toContain("dataset.active");
		expect(migration).toContain("dataset.import_enabled");
		expect(migration).toContain("dataset.license_review_status = 'approved'");
		expect(migration).toContain("dataset.imported_at is not null");
	});

	it("applies attribution completeness to every reusable field, nutrient, and serving", () => {
		expect(migration.match(
			/or not public\.blendcalc_api_v1_source_attribution_is_complete\(/g,
		)).toHaveLength(3);
		expect(migration).toContain("'field_source_not_redistributable'");
		expect(migration).toContain("'nutrient_source_not_redistributable'");
		expect(migration).toContain("'serving_source_not_redistributable'");
	});

	it("keeps the attribution helper private to the trusted server role", () => {
		expect(migration).toMatch(
			/revoke all on function public\.blendcalc_api_v1_source_attribution_is_complete\(text, text\)\s+from public, anon, authenticated;/,
		);
		expect(migration).toMatch(
			/grant execute on function public\.blendcalc_api_v1_source_attribution_is_complete\(text, text\)\s+to service_role;/,
		);
	});
});
