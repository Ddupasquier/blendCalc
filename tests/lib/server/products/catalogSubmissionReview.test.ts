import { describe, expect, it } from "vitest";
import { evaluateCatalogSubmissionEvidence } from "$lib/server/products/catalogSubmissionReview.server";

describe("catalog submission evidence review", () => {
	it("requires all three label photos for a noncanonical source match", () => {
		expect(
			evaluateCatalogSubmissionEvidence({
				hasSourceMatch: true,
				sourceCanAutoPublish: false,
				needsSourceComparisonReview: false,
				hasCanonicalImage: false,
				evidencePaths: { front: "front.jpg" },
			}),
		).toEqual({
			evidenceComplete: false,
			hasSourceMatchedImageEvidence: false,
			requiresSourceEvidenceReview: true,
		});
		expect(
			evaluateCatalogSubmissionEvidence({
				hasSourceMatch: true,
				sourceCanAutoPublish: false,
				needsSourceComparisonReview: false,
				hasCanonicalImage: false,
				evidencePaths: {
					front: "front.jpg",
					nutrition: "nutrition.jpg",
					barcode: "barcode.jpg",
				},
			}).evidenceComplete,
		).toBe(true);
	});

	it("keeps front-only image review for a canonical source match", () => {
		expect(
			evaluateCatalogSubmissionEvidence({
				hasSourceMatch: true,
				sourceCanAutoPublish: true,
				needsSourceComparisonReview: false,
				hasCanonicalImage: false,
				evidencePaths: { front: "front.jpg" },
			}),
		).toEqual({
			evidenceComplete: true,
			hasSourceMatchedImageEvidence: true,
			requiresSourceEvidenceReview: false,
		});
	});
});
