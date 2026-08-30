import type { NutrientRelationshipRule } from "$lib/utils/food/nutrients/nutrientRelationshipRules";

export type ProductDifferenceSeverity = "low" | "medium" | "high";

export type ProductDifferenceThreshold = {
	severity: ProductDifferenceSeverity;
	minimumDifferenceRatio: number;
	minimumAbsoluteDifference: number;
	evaluationOrder: number;
};

export type ProductSourceFieldCoveragePolicy = {
	providerKey: string;
	reportedCoverageTtlSeconds: number;
	notReportedCoverageTtlSeconds: number;
	notFoundCoverageTtlSeconds: number;
};

export type ProductResolutionPolicy = {
	key: string;
	version: number;
	displayName: string;
	minimumRelatedNameTokenOverlap: number;
	numericDifferenceRatioFloor: number;
	servingWeightToleranceGrams: number;
	categorySuggestionMinimumScore: number;
	sourceReference: string;
	reviewedAt: string;
	rankValues: ReadonlyMap<string, ReadonlyMap<string, number>>;
	scoringWeights: ReadonlyMap<string, ReadonlyMap<string, number>>;
	differenceThresholds: ReadonlyMap<
		string,
		readonly ProductDifferenceThreshold[]
	>;
	ignoredTerms: ReadonlyMap<string, ReadonlySet<string>>;
	sourceFieldCoveragePolicies: ReadonlyMap<
		string,
		ProductSourceFieldCoveragePolicy
	>;
	nutrientRelationshipRules: readonly NutrientRelationshipRule[];
};

const readNestedPolicyValue = (
	values: ReadonlyMap<string, ReadonlyMap<string, number>>,
	context: string,
	key: string,
	valueKind: string,
) => {
	const value = values.get(context)?.get(key);
	if (value === undefined) {
		throw new Error(
			`Product resolution policy is missing ${valueKind} ${context}:${key}.`,
		);
	}
	return value;
};

export const getProductResolutionRank = (
	policy: ProductResolutionPolicy,
	context: string,
	valueKey: string,
) => readNestedPolicyValue(policy.rankValues, context, valueKey, "rank");

export const getProductResolutionScoringWeight = (
	policy: ProductResolutionPolicy,
	context: string,
	metricKey: string,
) => readNestedPolicyValue(policy.scoringWeights, context, metricKey, "weight");

export const getProductDifferenceThresholds = (
	policy: ProductResolutionPolicy,
	comparisonContext: string,
) => {
	const thresholds = policy.differenceThresholds.get(comparisonContext);
	if (!thresholds?.length) {
		throw new Error(
			`Product resolution policy is missing thresholds for ${comparisonContext}.`,
		);
	}
	return thresholds;
};

export const getNumericProductDifferenceSeverity = (
	policy: ProductResolutionPolicy,
	comparisonContext: string,
	leftValue: number,
	rightValue: number,
) => {
	const absoluteDifference = Math.abs(leftValue - rightValue);
	const differenceRatio =
		absoluteDifference /
		Math.max(
			Math.abs(leftValue),
			Math.abs(rightValue),
			policy.numericDifferenceRatioFloor,
		);

	return (
		getProductDifferenceThresholds(policy, comparisonContext).find(
			(threshold) =>
				differenceRatio >= threshold.minimumDifferenceRatio &&
				absoluteDifference >= threshold.minimumAbsoluteDifference,
		)?.severity ?? null
	);
};

export const getProductResolutionIgnoredTerms = (
	policy: ProductResolutionPolicy,
	termContext: string,
) => policy.ignoredTerms.get(termContext) ?? new Set<string>();

export const getProductSourceFieldCoveragePolicy = (
	policy: ProductResolutionPolicy,
	providerKey: string,
) => {
	const coveragePolicy = policy.sourceFieldCoveragePolicies.get(providerKey);
	if (!coveragePolicy) {
		throw new Error(
			`Product resolution policy is missing source coverage for ${providerKey}.`,
		);
	}
	return coveragePolicy;
};
