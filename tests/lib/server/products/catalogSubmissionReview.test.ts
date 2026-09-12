import { describe, expect, it } from "vitest";
import {
	buildProductSubmissionReviewFlags,
	evaluateCatalogSubmissionEvidence,
	resolveCatalogSubmissionTrust,
} from "$lib/server/products/catalogSubmissionReview.server";

describe("catalog submission evidence review", () => {
	it("accepts an unchanged exact source match without duplicate photos", () => {
		expect(
			evaluateCatalogSubmissionEvidence({
				hasSourceMatch: true,
				sourceCanAutoPublish: false,
				needsSourceComparisonReview: false,
				hasCanonicalImage: false,
				evidencePaths: { front: "front.jpg" },
			}),
		).toEqual({
			evidenceComplete: true,
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

	it("reuses a canonical front image when source facts changed", () => {
		expect(
			evaluateCatalogSubmissionEvidence({
				hasSourceMatch: true,
				sourceCanAutoPublish: true,
				needsSourceComparisonReview: true,
				hasCanonicalImage: true,
				evidencePaths: {
					nutrition: "nutrition.jpg",
					barcode: "barcode.jpg",
				},
			}).evidenceComplete,
		).toBe(true);
		expect(
			evaluateCatalogSubmissionEvidence({
				hasSourceMatch: true,
				sourceCanAutoPublish: true,
				needsSourceComparisonReview: true,
				hasCanonicalImage: true,
				evidencePaths: {
					front: "front.jpg",
					nutrition: "nutrition.jpg",
					barcode: "barcode.jpg",
				},
			}).evidenceComplete,
		).toBe(true);
	});

	it("requires only evidence for unsupported fields in a catalog correction", () => {
		expect(
			evaluateCatalogSubmissionEvidence({
				hasSourceMatch: true,
				sourceCanAutoPublish: false,
				needsSourceComparisonReview: true,
				hasCanonicalImage: true,
				evidencePaths: { nutrition: "nutrition.jpg" },
				catalogCorrectionFieldPaths: ["nutrient:1093"],
				sourceSupportsCorrection: false,
			}),
		).toMatchObject({
			evidenceComplete: true,
			requiredEvidenceRoles: ["nutrition"],
		});
	});

	it("reuses legally publishable provider evidence for an exact correction", () => {
		expect(
			evaluateCatalogSubmissionEvidence({
				hasSourceMatch: true,
				sourceCanAutoPublish: true,
				needsSourceComparisonReview: true,
				hasCanonicalImage: true,
				evidencePaths: {},
				catalogCorrectionFieldPaths: ["nutrient:1093"],
				sourceSupportsCorrection: true,
			}),
		).toMatchObject({
			evidenceComplete: true,
			requiredEvidenceRoles: [],
		});
	});

	it("marks an extreme retained-evidence serving disagreement as untrusted", () => {
		const servingMessage =
			"Submitted serving weight (1,814.37 g) differs from the trusted comparison value (28 g).";
		const issues = buildProductSubmissionReviewFlags({
			retainedEvidenceComparisons: [
				{
					source: "usda",
					sourceReference: "el-pato-serving-observation",
					comparison: {
						matchesExisting: false,
						hasBlockingIdentityMismatch: false,
						changedFields: ["servingWeightGrams"],
						changes: [
							{
								field: "servingWeightGrams",
								label: "Serving weight",
								message: servingMessage,
								severity: "high",
								changeType: "changed",
								previousValue: 28,
								submittedValue: 1814.37,
							},
						],
						issues: [servingMessage],
						severeDifferences: [servingMessage],
					},
				},
			],
		});

		expect(issues).toEqual([
			"Stored exact-barcode evidence from usda (el-pato-serving-observation) conflicts with the submitted package data.",
			servingMessage,
		]);
		expect(
			resolveCatalogSubmissionTrust({
				hasTrustedEvidenceConflict: true,
				retainedEvidenceLookupFailed: false,
				hasSourceMatch: false,
			}),
		).toEqual({
			valid: false,
			trustDisposition: "conflicts-with-trusted-evidence",
		});
	});

	it("blocks automatic trust when the retained evidence bank is unavailable", () => {
		expect(
			resolveCatalogSubmissionTrust({
				hasTrustedEvidenceConflict: false,
				retainedEvidenceLookupFailed: true,
				hasSourceMatch: true,
			}),
		).toEqual({
			valid: false,
			trustDisposition: "trusted-evidence-check-incomplete",
		});
	});
});
