import type { Database } from "$lib/types/database.types";
import {
	normalizeFoodCategoryValue,
	toFoodCategoryTokens,
} from "$lib/utils/food/categories/categoryNormalization.js";
import type {
	FoodCategoryPickerData,
	FoodCategoryPickerOption,
} from "$lib/utils/food/categories/categoryPicker";
import {
	getProductResolutionIgnoredTerms,
	getProductResolutionScoringWeight,
	type ProductResolutionPolicy,
} from "$lib/utils/products/productResolutionPolicy";
import type { SupabaseClient } from "@supabase/supabase-js";

type CategoryOptionRow = Pick<
	Database["public"]["Tables"]["custom_food_category_options"]["Row"],
	| "id"
	| "label"
	| "normalized_value"
	| "observation_count"
	| "source_count"
	| "verification_status"
	| "symbol_key"
>;

const CATEGORY_CANDIDATE_LIMIT = 120;
const CATEGORY_RESULT_LIMIT = 30;
const CATEGORY_SUGGESTION_LIMIT = 3;
const COMMON_CATEGORY_LIMIT = 12;
const uniqueTokens = (values: string[], ignoredTerms: ReadonlySet<string>) => [
	...new Set(
		values
			.flatMap((value) => toFoodCategoryTokens(value))
			.filter((token) => !ignoredTerms.has(token)),
	),
];

const toPickerOption = (row: CategoryOptionRow): FoodCategoryPickerOption => ({
	id: row.id,
	label: row.label,
	observationCount: row.observation_count,
	sourceCount: row.source_count,
	verificationStatus: row.verification_status,
	symbolKey: row.symbol_key,
});

const getQualityScore = (
	row: CategoryOptionRow,
	policy: ProductResolutionPolicy,
) =>
	Math.min(row.source_count, 3) *
		getProductResolutionScoringWeight(
			policy,
			"category-candidate",
			"source-count",
		) +
	Math.min(Math.log2(row.observation_count + 1), 10) *
		getProductResolutionScoringWeight(
			policy,
			"category-candidate",
			"observation-log",
		);

export const scoreFoodCategoryCandidate = (
	row: CategoryOptionRow,
	contextValues: string[],
	policy: ProductResolutionPolicy,
	query = "",
) => {
	const ignoredTerms = getProductResolutionIgnoredTerms(
		policy,
		"category-token",
	);
	const categoryTokens = uniqueTokens([row.normalized_value], ignoredTerms);
	const contextTokens = uniqueTokens(contextValues, ignoredTerms);
	if (!categoryTokens.length || !contextTokens.length) return 0;

	const contextTokenSet = new Set(contextTokens);
	const overlapCount = categoryTokens.filter((token) =>
		contextTokenSet.has(token),
	).length;
	if (!overlapCount) return 0;

	const categoryCoverage = overlapCount / categoryTokens.length;
	const contextCoverage = overlapCount / contextTokens.length;
	const normalizedContext = normalizeFoodCategoryValue(contextValues.join(" "));
	const normalizedCategory = normalizeFoodCategoryValue(row.normalized_value);
	const normalizedQuery = normalizeFoodCategoryValue(query);

	const weight = (metricKey: string) =>
		getProductResolutionScoringWeight(policy, "category-candidate", metricKey);
	let score =
		categoryCoverage * weight("category-coverage") +
		overlapCount * weight("overlap-count") +
		contextCoverage * weight("context-coverage") +
		getQualityScore(row, policy);
	if (normalizedContext.includes(normalizedCategory)) {
		score += weight("context-contains-category");
	}
	if (normalizedQuery && normalizedCategory === normalizedQuery) {
		score += weight("query-exact");
	} else if (
		normalizedQuery &&
		normalizedCategory.startsWith(normalizedQuery)
	) {
		score += weight("query-starts-with");
	} else if (normalizedQuery && normalizedCategory.includes(normalizedQuery)) {
		score += weight("query-contains");
	}

	return score;
};

const buildCandidateFilter = (tokens: string[]) =>
	tokens
		.slice(0, 8)
		.map((token) => `normalized_value.ilike.%${token}%`)
		.join(",");

const readCandidateRows = async (
	supabase: SupabaseClient<Database>,
	contextValues: string[],
	policy: ProductResolutionPolicy,
) => {
	const tokens = uniqueTokens(
		contextValues,
		getProductResolutionIgnoredTerms(policy, "category-token"),
	);
	if (!tokens.length) return [];

	const { data, error } = await supabase
		.from("custom_food_category_options")
		.select(
			"id, label, normalized_value, observation_count, source_count, verification_status, symbol_key",
		)
		.eq("enabled", true)
		.or(buildCandidateFilter(tokens))
		.order("source_count", { ascending: false })
		.order("observation_count", { ascending: false })
		.order("label", { ascending: true })
		.limit(CATEGORY_CANDIDATE_LIMIT);
	if (error) throw error;
	return data ?? [];
};

const rankRows = (
	rows: CategoryOptionRow[],
	contextValues: string[],
	policy: ProductResolutionPolicy,
	query = "",
) =>
	rows
		.map((row) => ({
			row,
			score: scoreFoodCategoryCandidate(row, contextValues, policy, query),
		}))
		.filter((candidate) => candidate.score > 0)
		.sort(
			(first, second) =>
				second.score - first.score ||
				second.row.source_count - first.row.source_count ||
				second.row.observation_count - first.row.observation_count ||
				first.row.label.localeCompare(second.row.label),
		);

const readCommonCategories = async (supabase: SupabaseClient<Database>) => {
	const { data, error } = await supabase
		.from("custom_food_category_options")
		.select(
			"id, label, normalized_value, observation_count, source_count, verification_status, symbol_key",
		)
		.eq("enabled", true)
		.eq("verification_status", "multi_source_verified")
		.order("observation_count", { ascending: false })
		.order("source_count", { ascending: false })
		.order("label", { ascending: true })
		.limit(COMMON_CATEGORY_LIMIT);
	if (error) throw error;
	return (data ?? []).map(toPickerOption);
};

const readDirectCategorySearchResults = async (
	supabase: SupabaseClient<Database>,
	query: string,
) => {
	const normalizedQuery = normalizeFoodCategoryValue(query);
	if (!normalizedQuery) return [];
	const { data, error } = await supabase
		.from("custom_food_category_options")
		.select(
			"id, label, normalized_value, observation_count, source_count, verification_status, symbol_key",
		)
		.eq("enabled", true)
		.ilike("normalized_value", `%${normalizedQuery}%`)
		.order("source_count", { ascending: false })
		.order("observation_count", { ascending: false })
		.order("label", { ascending: true })
		.limit(CATEGORY_RESULT_LIMIT);
	if (error) throw error;
	return (data ?? []).map(toPickerOption);
};

export const readFoodCategoryPickerData = async (
	supabase: SupabaseClient<Database>,
	input: {
		productName?: string;
		query?: string;
		sourceCategories?: string[];
	},
	policy: ProductResolutionPolicy | null,
): Promise<FoodCategoryPickerData> => {
	const productName = input.productName?.trim() ?? "";
	const query = input.query?.trim() ?? "";
	const sourceCategories = (input.sourceCategories ?? [])
		.map((category) => category.trim())
		.filter(Boolean);
	const suggestionContext = [productName, ...sourceCategories].filter(Boolean);

	if (query) {
		if (!policy) {
			return {
				suggestions: [],
				common: [],
				results: await readDirectCategorySearchResults(supabase, query),
			};
		}
		const resultRows = await readCandidateRows(supabase, [query], policy);
		const results = rankRows(resultRows, [query], policy, query)
			.slice(0, CATEGORY_RESULT_LIMIT)
			.map((candidate) => toPickerOption(candidate.row));
		return { suggestions: [], common: [], results };
	}

	const common = await readCommonCategories(supabase);
	if (!policy) return { suggestions: [], common, results: [] };

	const suggestionRows = await readCandidateRows(
		supabase,
		suggestionContext,
		policy,
	);

	const suggestions = rankRows(suggestionRows, suggestionContext, policy)
		.filter(
			(candidate) => candidate.score >= policy.categorySuggestionMinimumScore,
		)
		.slice(0, CATEGORY_SUGGESTION_LIMIT)
		.map((candidate) => toPickerOption(candidate.row));
	return { suggestions, common, results: [] };
};
