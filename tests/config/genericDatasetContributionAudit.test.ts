import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const auditScript = readFileSync(
	"scripts/audits/food-sources/audit_generic_dataset_contribution.mjs",
	"utf8",
);

describe("generic dataset contribution audit", () => {
	it("measures contribution without treating names as identity", () => {
		expect(auditScript).toContain("exactIdentifierRecordCount");
		expect(auditScript).toContain("exactIdentifierCount");
		expect(auditScript).toContain("exclusiveNormalizedDescriptionCount");
		expect(auditScript).toContain("queryCoverageCount");
		expect(auditScript).toContain("Normalized description and search overlap are contribution metrics only");
	});

	it("is read-only and does not publish or mutate dataset rows", () => {
		expect(auditScript).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
	});
});
