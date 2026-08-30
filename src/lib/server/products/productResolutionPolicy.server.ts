import { createServerCachedLoader } from "$lib/server/cache/serverCachedLoader";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { Database } from "$lib/types/database.types";
import { readNutrientRelationshipRules } from "$lib/utils/food/nutrients/nutrientRelationshipRules";
import type {
	ProductDifferenceSeverity,
	ProductDifferenceThreshold,
	ProductResolutionPolicy,
	ProductSourceFieldCoveragePolicy,
} from "$lib/utils/products/productResolutionPolicy";
import type { SupabaseClient } from "@supabase/supabase-js";

const CACHE_DURATION_MILLISECONDS = 10 * 60 * 1000;
const SCHEMA_RECHECK_DURATION_MILLISECONDS = 30 * 1000;
const PRODUCT_RESOLUTION_SCHEMA_OBJECTS = [
	"product_resolution_policy_versions",
	"product_resolution_rank_values",
	"product_resolution_scoring_weights",
	"product_resolution_difference_thresholds",
	"product_resolution_ignored_terms",
	"product_source_field_coverage_policies",
	"nutrient_relationship_rules",
	"assessment_policy_key",
	"exact_source_score",
	"mapped_source_score",
	"derived_source_score",
	"missing_source_score",
	"required_nutrient_weight",
	"recommended_nutrient_weight",
	"partial_minimum_ratio",
] as const;

type DatabaseSchemaError = {
	code?: string;
	message?: string;
};

export const isProductResolutionPolicySchemaUnavailable = (
	error: DatabaseSchemaError | null | undefined,
) => {
	if (
		!error?.code ||
		!["42703", "42P01", "PGRST204", "PGRST205"].includes(error.code)
	) {
		return false;
	}
	const message = error.message?.toLowerCase() ?? "";
	return PRODUCT_RESOLUTION_SCHEMA_OBJECTS.some((objectName) =>
		message.includes(objectName.toLowerCase()),
	);
};

const addNestedNumber = (
	values: Map<string, Map<string, number>>,
	context: string,
	key: string,
	value: number,
) => {
	const contextValues = values.get(context) ?? new Map<string, number>();
	contextValues.set(key, value);
	values.set(context, contextValues);
};

const isDifferenceSeverity = (
	value: string,
): value is ProductDifferenceSeverity =>
	value === "low" || value === "medium" || value === "high";

export const readDefaultProductResolutionPolicy = async (
	supabase: SupabaseClient<Database>,
): Promise<ProductResolutionPolicy> => {
	const policyResult = await supabase
		.from("product_resolution_policy_versions")
		.select(
			"key, version, display_name, minimum_related_name_token_overlap, numeric_difference_ratio_floor, serving_weight_tolerance_grams, category_suggestion_minimum_score, source_reference, reviewed_at",
		)
		.eq("enabled", true)
		.eq("is_default", true)
		.single();
	if (policyResult.error) throw policyResult.error;
	const policyRow = policyResult.data;

	const [
		rankResult,
		weightResult,
		thresholdResult,
		ignoredTermResult,
		coverageResult,
		nutrientRelationshipRules,
	] = await Promise.all([
		supabase
			.from("product_resolution_rank_values")
			.select("ranking_context, value_key, rank_value")
			.eq("policy_key", policyRow.key),
		supabase
			.from("product_resolution_scoring_weights")
			.select("scoring_context, metric_key, weight")
			.eq("policy_key", policyRow.key),
		supabase
			.from("product_resolution_difference_thresholds")
			.select(
				"comparison_context, severity, minimum_difference_ratio, minimum_absolute_difference, evaluation_order",
			)
			.eq("policy_key", policyRow.key)
			.order("comparison_context", { ascending: true })
			.order("evaluation_order", { ascending: true }),
		supabase
			.from("product_resolution_ignored_terms")
			.select("term_context, term")
			.eq("policy_key", policyRow.key),
		supabase
			.from("product_source_field_coverage_policies")
			.select(
				"provider_key, reported_coverage_ttl_seconds, not_reported_coverage_ttl_seconds, not_found_coverage_ttl_seconds",
			)
			.eq("policy_key", policyRow.key),
		readNutrientRelationshipRules(supabase),
	]);

	for (const result of [
		rankResult,
		weightResult,
		thresholdResult,
		ignoredTermResult,
		coverageResult,
	]) {
		if (result.error) throw result.error;
	}

	const rankValues = new Map<string, Map<string, number>>();
	for (const row of rankResult.data ?? []) {
		addNestedNumber(
			rankValues,
			row.ranking_context,
			row.value_key,
			row.rank_value,
		);
	}

	const scoringWeights = new Map<string, Map<string, number>>();
	for (const row of weightResult.data ?? []) {
		addNestedNumber(
			scoringWeights,
			row.scoring_context,
			row.metric_key,
			row.weight,
		);
	}

	const differenceThresholds = new Map<string, ProductDifferenceThreshold[]>();
	for (const row of thresholdResult.data ?? []) {
		if (!isDifferenceSeverity(row.severity)) {
			throw new Error(
				`Product resolution severity ${row.severity} is not supported.`,
			);
		}
		const thresholds = differenceThresholds.get(row.comparison_context) ?? [];
		thresholds.push({
			severity: row.severity,
			minimumDifferenceRatio: row.minimum_difference_ratio,
			minimumAbsoluteDifference: row.minimum_absolute_difference,
			evaluationOrder: row.evaluation_order,
		});
		differenceThresholds.set(row.comparison_context, thresholds);
	}

	const ignoredTerms = new Map<string, Set<string>>();
	for (const row of ignoredTermResult.data ?? []) {
		const terms = ignoredTerms.get(row.term_context) ?? new Set<string>();
		terms.add(row.term);
		ignoredTerms.set(row.term_context, terms);
	}

	const sourceFieldCoveragePolicies = new Map<
		string,
		ProductSourceFieldCoveragePolicy
	>();
	for (const row of coverageResult.data ?? []) {
		sourceFieldCoveragePolicies.set(row.provider_key, {
			providerKey: row.provider_key,
			reportedCoverageTtlSeconds: row.reported_coverage_ttl_seconds,
			notReportedCoverageTtlSeconds: row.not_reported_coverage_ttl_seconds,
			notFoundCoverageTtlSeconds: row.not_found_coverage_ttl_seconds,
		});
	}

	if (
		rankValues.size === 0 ||
		scoringWeights.size === 0 ||
		differenceThresholds.size === 0 ||
		ignoredTerms.size === 0 ||
		sourceFieldCoveragePolicies.size === 0 ||
		!nutrientRelationshipRules?.length
	) {
		throw new Error(
			`Product resolution policy ${policyRow.key} is incomplete.`,
		);
	}

	return {
		key: policyRow.key,
		version: policyRow.version,
		displayName: policyRow.display_name,
		minimumRelatedNameTokenOverlap:
			policyRow.minimum_related_name_token_overlap,
		numericDifferenceRatioFloor: policyRow.numeric_difference_ratio_floor,
		servingWeightToleranceGrams: policyRow.serving_weight_tolerance_grams,
		categorySuggestionMinimumScore: policyRow.category_suggestion_minimum_score,
		sourceReference: policyRow.source_reference,
		reviewedAt: policyRow.reviewed_at,
		rankValues,
		scoringWeights,
		differenceThresholds,
		ignoredTerms,
		sourceFieldCoveragePolicies,
		nutrientRelationshipRules,
	};
};

export const getDefaultProductResolutionPolicy = createServerCachedLoader({
	load: () => readDefaultProductResolutionPolicy(getSupabaseAdminClient()),
	ttlMilliseconds: CACHE_DURATION_MILLISECONDS,
});

export const getProductResolutionPolicyIfAvailable = createServerCachedLoader({
	load: async () => {
		try {
			return await readDefaultProductResolutionPolicy(getSupabaseAdminClient());
		} catch (error) {
			if (
				isProductResolutionPolicySchemaUnavailable(error as DatabaseSchemaError)
			) {
				return null;
			}
			throw error;
		}
	},
	ttlMilliseconds: SCHEMA_RECHECK_DURATION_MILLISECONDS,
});
