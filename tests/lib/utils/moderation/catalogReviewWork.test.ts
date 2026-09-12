import { describe, expect, it } from "vitest";
import {
	filterCatalogReviewWorkForProduct,
	groupCatalogReviewWorkByProduct,
	type CatalogReviewWorkSummary,
} from "$lib/utils/moderation/catalogReviewWork";

const reviewWork: CatalogReviewWorkSummary = {
	conflicts: [
		{
			id: "conflict-a",
			productId: "product-a",
			barcode: "00011110129505",
			productName: "Peanut Butter",
			fieldPath: "ingredients",
			observedValues: [],
			severity: "high",
			createdAt: "2026-08-22T12:00:00.000Z",
		},
		{
			id: "conflict-b",
			productId: "product-a",
			barcode: "00011110129505",
			productName: "Peanut Butter",
			fieldPath: "nutrient:1093",
			observedValues: [],
			severity: "medium",
			createdAt: "2026-08-23T12:00:00.000Z",
		},
	],
	providerChanges: [
		{
			id: "provider-a",
			sharedProductId: "product-a",
			barcode: "00011110129505",
			productName: "Peanut Butter",
			sourceName: "Open Food Facts",
			changeSummary: { changes: [] },
			materialFieldPaths: ["ingredients"],
			observedAt: "2026-08-24T12:00:00.000Z",
			createdAt: "2026-08-24T12:00:00.000Z",
			correctionStatus: null,
			submissionId: null,
		},
	],
	safetyMatches: [
		{
			id: "recall-b",
			sharedProductId: "product-b",
			barcode: "00022220259000",
			productName: "Almond Butter",
			brandOwner: "QA Foods",
			alertProductDescription: "Almond Butter",
			classification: "Class I",
			reason: null,
			packageDescription: null,
			codeInformation: null,
			sourceUrl: "https://example.test/recall",
			sourceName: "FDA",
			matchEvidence: {},
			requiresPackageCheck: false,
			detectedAt: "2026-08-25T12:00:00.000Z",
		},
	],
	counts: { conflicts: 2, providerChanges: 1, safetyMatches: 1 },
	issueLimit: 20,
};

describe("catalog review product grouping", () => {
	it("shows one product summary with the complete category breakdown", () => {
		const products = groupCatalogReviewWorkByProduct(reviewWork);

		expect(products).toHaveLength(2);
		expect(products[0]).toMatchObject({
			productId: "product-b",
			counts: {
				safetyMatches: 1,
				conflicts: 0,
				providerChanges: 0,
				total: 1,
			},
		});
		expect(products[1]).toMatchObject({
			productId: "product-a",
			counts: {
				safetyMatches: 0,
				conflicts: 2,
				providerChanges: 1,
				total: 3,
			},
		});
	});

	it("filters every review category for one product", () => {
		const filtered = filterCatalogReviewWorkForProduct(reviewWork, "product-a");

		expect(filtered.conflicts).toHaveLength(2);
		expect(filtered.providerChanges).toHaveLength(1);
		expect(filtered.safetyMatches).toHaveLength(0);
		expect(filtered.counts).toEqual({
			conflicts: 2,
			providerChanges: 1,
			safetyMatches: 0,
		});
	});
});
