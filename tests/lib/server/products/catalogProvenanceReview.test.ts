import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
	"src/lib/server/products/catalogProvenanceReview.server.ts",
	"utf8",
);

describe("catalog provenance moderation read", () => {
	it("does not select private observation or submitter data", () => {
		expect(source).not.toContain("raw_payload");
		expect(source).not.toContain("submitted_by");
		expect(source).not.toContain("submission_id");
		expect(source).not.toContain("evidence_paths");
	});

	it("reads field values and their exact observation metadata", () => {
		expect(source).toContain("source_value");
		expect(source).toContain("normalized_value");
		expect(source).toContain("shared_product_observations(id, source");
		expect(source).toContain("source_license");
		expect(source).toContain("observed_at");
	});
});
