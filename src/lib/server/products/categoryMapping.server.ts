import type { Database } from "$lib/types/database.types";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import { normalizeFoodCategoryValue } from "$lib/utils/food/categories/categoryNormalization.js";
import type { SupabaseClient } from "@supabase/supabase-js";

type CategoryMappingRow = Pick<
	Database["public"]["Tables"]["custom_food_category_mappings"]["Row"],
	| "source_normalized_value"
	| "category_option_id"
	| "category_option_label"
	| "confidence"
	| "observation_count"
>;

const confidenceRank = (confidence: string) => {
	if (confidence === "exact") return 4;
	if (confidence === "strong") return 3;
	if (confidence === "related") return 2;
	return 1;
};

const rankCategoryMapping = (
	mapping: CategoryMappingRow,
	sourceOrder: Map<string, number>,
) =>
	confidenceRank(mapping.confidence) * 1_000_000 +
	(sourceOrder.get(mapping.source_normalized_value) ?? 0) * 10_000 +
	mapping.observation_count;

export const resolveBarcodeDraftCategory = async (
	supabase: SupabaseClient<Database>,
	draft: BarcodeProductDraft,
): Promise<BarcodeProductDraft> => {
	const sourceValues = draft.categories ?? [];
	const normalizedValues = [
		...new Set(sourceValues.map(normalizeFoodCategoryValue).filter(Boolean)),
	];
	if (!normalizedValues.length) return draft;

	const { data, error } = await supabase
		.from("custom_food_category_mappings")
		.select(
			"source_normalized_value, category_option_id, category_option_label, confidence, observation_count",
		)
		.in("source_normalized_value", normalizedValues);

	if (error || !data?.length) return draft;

	const sourceOrder = new Map(
		normalizedValues.map((value, index) => [value, index]),
	);
	const bestMapping = [...data].sort(
		(first, second) =>
			rankCategoryMapping(second, sourceOrder) -
			rankCategoryMapping(first, sourceOrder),
	)[0];

	if (!bestMapping) return draft;

	return {
		...draft,
		resolvedCategory: bestMapping.category_option_label,
		categoryResolution: {
			categoryOptionId: bestMapping.category_option_id,
			label: bestMapping.category_option_label,
			sourceValue: bestMapping.source_normalized_value,
			confidence: bestMapping.confidence,
		},
	};
};
