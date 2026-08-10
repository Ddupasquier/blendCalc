import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260722162000_national_dataset_redistribution_policies.sql",
	"utf8",
);

describe("national dataset redistribution policy migration", () => {
	it("records reviewed canonical-storage decisions for CNF and CoFID", () => {
		expect(migration).toContain("where key = 'health-canada-cnf'");
		expect(migration).toContain("where key = 'uk-cofid'");
		expect(migration.match(/canonical_storage_allowed = true/g)).toHaveLength(2);
		expect(migration).toContain("Open Government Licence – Canada");
		expect(migration).toContain("Open Government Licence v3.0");
		expect(migration).toContain("canonical_policy_reviewed_at");
	});

	it("preserves attribution requirements and official policy evidence", () => {
		expect(migration).toContain("requires_attribution', true");
		expect(migration).toContain("must not imply endorsement");
		expect(migration).toContain("https://open.canada.ca/en/frequently-asked-questions");
		expect(migration).toContain(
			"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		);
	});

	it("marks only the matching normalized datasets as canonically reusable", () => {
		expect(migration).toContain("public.generic_food_datasets");
		expect(migration).toContain("where key in ('cnf-2026', 'cofid-2021')");
	});
});
