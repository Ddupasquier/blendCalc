import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const profilesMigration = readFileSync(
	"supabase/migrations/20260803110000_evidence_aware_api_publication_profiles.sql",
	"utf8",
);
const readinessMigration = readFileSync(
	"supabase/migrations/20260803110100_strict_api_publication_readiness.sql",
	"utf8",
);

describe("evidence-aware blendCalcAPI publication profiles", () => {
	it("owns publication requirements in a versioned database profile", () => {
		expect(profilesMigration).toContain(
			"create table public.blendcalc_api_publication_profiles",
		);
		expect(profilesMigration).toContain("'api-v1-packaged-product-v1'");
		expect(profilesMigration).toContain("'api-v1-packaged-core-v1'");
		expect(profilesMigration).toContain("required_field_paths");
		expect(profilesMigration).toContain("blocked_conflict_severities");
		expect(profilesMigration).toContain("max_verification_age_days");
	});

	it("keeps reported zeroes explicit and refuses unsupported nutrient states", () => {
		expect(profilesMigration).toContain(
			"array['reported', 'reported-zero', 'derived']",
		);
		expect(readinessMigration).toContain("'unsupported_nutrient_value_state'");
		expect(readinessMigration).toContain("'derived_nutrient_missing_method'");
		expect(readinessMigration).toContain("'unreviewed_nutrient_mapping'");
	});

	it("requires complete core nutrition, serving evidence, and provenance", () => {
		expect(profilesMigration).toContain("v_requirement_count <> 8");
		expect(readinessMigration).toContain("'missing_required_nutrient:'");
		expect(readinessMigration).toContain(
			"'missing_evidence_backed_primary_serving'",
		);
		expect(readinessMigration).toContain("'missing_nutrient_provenance'");
		expect(readinessMigration).toContain("'missing_serving_provenance'");
	});

	it("fails closed for material conflicts and stale verification", () => {
		expect(profilesMigration).toContain("array['medium', 'high']");
		expect(readinessMigration).toContain("'unresolved_material_conflict'");
		expect(readinessMigration).toContain("'verification_expired'");
		expect(readinessMigration).toContain("'missing_publication_profile'");
	});

	it("keeps publication diagnostics private and transparent", () => {
		expect(readinessMigration).toContain("publication_status");
		expect(readinessMigration).toContain("quality_dimensions");
		expect(readinessMigration).toContain("'missingNutrientIds'");
		expect(readinessMigration).toContain("'allergenEvidence'");
		expect(readinessMigration).toContain("to service_role");
	});
});
