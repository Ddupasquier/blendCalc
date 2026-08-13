import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260812200000_local_ucum_reference_standard.sql",
	"utf8",
);
const seedScript = readFileSync(
	"scripts/seeds/catalog/seed_product_reference_data.mjs",
	"utf8",
);
const referenceApiHelpers = readFileSync(
	"scripts/lib/reference-data/api.mjs",
	"utf8",
);

describe("local UCUM reference standard", () => {
	it("retires the NLM service identity without deleting its history", () => {
		expect(migration).toContain("'ucum-standard'");
		expect(migration).toContain("where key = 'ucum-nlm'");
		expect(migration).toContain("replacementSourceKey");
		expect(migration).toContain("'reviewed_standard'");
		expect(migration).toContain("'api_observed_ratio'");
		expect(migration).toContain("'standards_api'");
		expect(migration).toContain("'moderator_verified'");
		expect(migration).toContain("'UCUM License v1.1'");
		expect(migration).toContain("'https://ucum.org/license'");
		expect(migration).toContain("false,");
	});

	it("keeps reference seeding independent from the NLM conversion service", () => {
		expect(seedScript).not.toContain("convertUcumUnit");
		expect(seedScript).not.toContain("ucum.nlm.nih.gov");
		expect(referenceApiHelpers).not.toContain("ucum.nlm.nih.gov");
	});
});
