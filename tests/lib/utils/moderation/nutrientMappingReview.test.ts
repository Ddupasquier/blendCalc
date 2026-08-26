import { describe, expect, it } from "vitest";
import {
	parseNutrientMappingReviewDecisionResult,
	parseNutrientMappingReviewWorkspace,
} from "$lib/utils/moderation/nutrientMappingReview";
import {
	nutrientMappingReviewDecisionFixture,
	nutrientMappingReviewWorkspaceFixture,
} from "../../../fixtures/nutrientMappingReview";

describe("nutrient mapping review contract", () => {
	it("parses the bounded review workspace and decision", () => {
		expect(
			parseNutrientMappingReviewWorkspace(
				nutrientMappingReviewWorkspaceFixture,
			),
		).toEqual(nutrientMappingReviewWorkspaceFixture);
		expect(
			parseNutrientMappingReviewDecisionResult(
				nutrientMappingReviewDecisionFixture,
			),
		).toEqual(nutrientMappingReviewDecisionFixture);
	});

	it("rejects malformed confidence, candidates, and outcomes", () => {
		expect(() =>
			parseNutrientMappingReviewWorkspace({
				...nutrientMappingReviewWorkspaceFixture,
				mapping: {
					...nutrientMappingReviewWorkspaceFixture.mapping,
					confidence: "high",
				},
			}),
		).toThrow(/mapping\.confidence/u);
		expect(() =>
			parseNutrientMappingReviewWorkspace({
				...nutrientMappingReviewWorkspaceFixture,
				compatibleNutrients: [{}],
			}),
		).toThrow(/compatibleNutrients\[0\]/u);
		expect(() =>
			parseNutrientMappingReviewDecisionResult({
				...nutrientMappingReviewDecisionFixture,
				outcome: "guessed",
			}),
		).toThrow(/outcome/u);
	});
});
