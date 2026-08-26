import type {
	NutrientMappingReviewDecisionResult,
	NutrientMappingReviewWorkspace,
} from "$lib/utils/moderation/nutrientMappingReview";

export const nutrientMappingReviewWorkspaceFixture: NutrientMappingReviewWorkspace =
	{
		mapping: {
			id: "72400000-0000-4000-8000-000000000010",
			sourceKey: "open-food-facts",
			sourceDisplayName: "Open Food Facts",
			sourceNutrientKey: "possible-protein",
			sourceNutrientName: "Possible protein",
			sourceUnitName: "G",
			mappingMethod: "api_taxonomy_match",
			confidence: 0.75,
			observationCount: 3,
			reviewStatus: "pending_review",
			reviewReference: null,
			reviewedAt: null,
			candidateReason:
				"The provider label resembles protein but lacks an exact reviewed key.",
			currentNutrient: {
				nutrientId: 1003,
				nutrientName: "Protein",
				nutrientNumber: "203",
				defaultUnitName: "G",
			},
		},
		compatibleNutrients: [
			{
				nutrientId: 1003,
				nutrientName: "Protein",
				nutrientNumber: "203",
				defaultUnitName: "G",
				conversionMultiplier: 1,
			},
			{
				nutrientId: 1079,
				nutrientName: "Fiber, total dietary",
				nutrientNumber: "291",
				defaultUnitName: "G",
				conversionMultiplier: 1,
			},
		],
		latestDecision: null,
	};

export const nutrientMappingReviewDecisionFixture: NutrientMappingReviewDecisionResult =
	{
		decisionId: "72400000-0000-4000-8000-000000000020",
		mappingId: nutrientMappingReviewWorkspaceFixture.mapping.id,
		outcome: "approved",
		reviewStatus: "approved",
		enabled: true,
		selectedNutrientId: 1003,
	};
