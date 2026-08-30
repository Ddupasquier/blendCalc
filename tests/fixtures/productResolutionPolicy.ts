import type { ProductResolutionPolicy } from "$lib/utils/products/productResolutionPolicy";

const createNumberMap = (values: Record<string, number>) =>
	new Map(Object.entries(values));

export const PRODUCT_RESOLUTION_POLICY_FIXTURE: ProductResolutionPolicy = {
	key: "exact-barcode-resolution-v1",
	version: 1,
	displayName: "Exact-barcode product resolution version 1",
	minimumRelatedNameTokenOverlap: 0.2,
	numericDifferenceRatioFloor: 0.001,
	servingWeightToleranceGrams: 0.1,
	categorySuggestionMinimumScore: 70,
	sourceReference: "test policy",
	reviewedAt: "2026-08-24T00:00:00.000Z",
	rankValues: new Map([
		[
			"field-confidence",
			createNumberMap({
				unknown: 0,
				imported: 1,
				"user-reported": 2,
				"source-verified": 3,
				corroborated: 4,
				"moderator-reviewed": 5,
			}),
		],
		[
			"usda-generic-data-type",
			createNumberMap({
				foundation: 0,
				"sr legacy": 1,
				"survey (fndds)": 2,
				branded: 3,
			}),
		],
	]),
	scoringWeights: new Map([
		["field:productName", createNumberMap({ "text-character": 1 })],
		["field:brandOwner", createNumberMap({ "text-character": 1 })],
		[
			"field:image",
			createNumberMap({
				"primary-image": 1,
				"thumbnail-image": 1,
			}),
		],
		[
			"field:categories",
			createNumberMap({
				"source-item": 1,
				"canonical-resolution": 10,
				"canonical-value": 1,
			}),
		],
		[
			"field:serving",
			createNumberMap({
				"source-serving": 10,
				"positive-weight": 1,
				"display-label": 1,
				"volume-equivalent": 1,
				"known-origin": 1,
			}),
		],
		[
			"field:ingredients",
			createNumberMap({
				"text-character": 1,
				"structured-item": 10,
			}),
		],
		...[
			"allergens",
			"traces",
			"precautionaryStatements",
			"dietaryTags",
			"labels",
			"structuredIngredients",
			"additives",
			"nutrition",
		].map(
			(field) =>
				[`field:${field}`, createNumberMap({ "source-item": 1 })] as const,
		),
		...["ingredientAnalysis", "package", "sourceMetadata"].map(
			(field) =>
				[
					`field:${field}`,
					createNumberMap({ "populated-property": 1 }),
				] as const,
		),
		["field:alcoholByVolume", createNumberMap({ "reported-value": 1 })],
		["field:regulatoryDisclosure", createNumberMap({ "profile-key": 1 })],
		[
			"category-candidate",
			createNumberMap({
				"category-coverage": 70,
				"overlap-count": 18,
				"context-coverage": 10,
				"source-count": 3,
				"observation-log": 1,
				"context-contains-category": 35,
				"query-exact": 120,
				"query-starts-with": 70,
				"query-contains": 45,
			}),
		],
	]),
	differenceThresholds: new Map([
		[
			"catalog-submission-nutrient",
			[
				{
					severity: "high",
					minimumDifferenceRatio: 0.75,
					minimumAbsoluteDifference: 1,
					evaluationOrder: 10,
				},
				{
					severity: "medium",
					minimumDifferenceRatio: 0.35,
					minimumAbsoluteDifference: 0.5,
					evaluationOrder: 20,
				},
				{
					severity: "low",
					minimumDifferenceRatio: 0.1,
					minimumAbsoluteDifference: 0.1,
					evaluationOrder: 30,
				},
			],
		],
		[
			"catalog-verification-numeric",
			[
				{
					severity: "high",
					minimumDifferenceRatio: 0.25,
					minimumAbsoluteDifference: 0,
					evaluationOrder: 10,
				},
				{
					severity: "medium",
					minimumDifferenceRatio: 0.1,
					minimumAbsoluteDifference: 0,
					evaluationOrder: 20,
				},
				{
					severity: "low",
					minimumDifferenceRatio: 0.03,
					minimumAbsoluteDifference: 0,
					evaluationOrder: 30,
				},
			],
		],
	]),
	ignoredTerms: new Map([
		["category-token", new Set(["and", "for", "from", "other", "the", "with"])],
	]),
	sourceFieldCoveragePolicies: new Map([
		[
			"usda",
			{
				providerKey: "usda",
				reportedCoverageTtlSeconds: 2_592_000,
				notReportedCoverageTtlSeconds: 2_592_000,
				notFoundCoverageTtlSeconds: 2_592_000,
			},
		],
		[
			"open-food-facts",
			{
				providerKey: "open-food-facts",
				reportedCoverageTtlSeconds: 604_800,
				notReportedCoverageTtlSeconds: 604_800,
				notFoundCoverageTtlSeconds: 43_200,
			},
		],
		[
			"cola-cloud",
			{
				providerKey: "cola-cloud",
				reportedCoverageTtlSeconds: 86_400,
				notReportedCoverageTtlSeconds: 86_400,
				notFoundCoverageTtlSeconds: 43_200,
			},
		],
	]),
	nutrientRelationshipRules: [
		{
			id: "added-sugars-not-above-total-sugars",
			parentNutrientId: 2000,
			childNutrientId: 1235,
			parentLabel: "total sugars",
			childLabel: "added sugars",
			relationship: "child_must_not_exceed_parent",
			severity: "error",
			issueCode: "NUTRIENT_CHILD_EXCEEDS_PARENT",
			requiresParent: true,
			tolerance: 0.01,
		},
		{
			id: "saturated-fat-not-above-total-fat",
			parentNutrientId: 1004,
			childNutrientId: 1258,
			parentLabel: "total fat",
			childLabel: "saturated fat",
			relationship: "child_must_not_exceed_parent",
			severity: "error",
			issueCode: "NUTRIENT_CHILD_EXCEEDS_PARENT",
			requiresParent: true,
			tolerance: 0.01,
		},
	],
};
