import type { Database } from "$lib/types/database.types";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import { normalizeFoodCategoryValue } from "$lib/utils/food/categories/categoryNormalization.js";
import type { FoodItem } from "$lib/utils/food/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyDatabaseQueryAbortSignal } from "$lib/utils/storage/supabase/databaseQueryAbortSignal";

export type ResolvedFoodCategory = {
	categoryOptionId: string;
	label: string;
	sourceValue: string;
	confidence: string;
	symbolKey?: string;
	updatedAt?: string | null;
};

export const mergeCanonicalFoodCategories = (
	label: string,
	sourceValues: string[] = [],
) => {
	const canonicalValue = normalizeFoodCategoryValue(label);
	return [
		label,
		...sourceValues.filter(
			(value) => normalizeFoodCategoryValue(value) !== canonicalValue,
		),
	];
};

export const applyCanonicalFoodCategory = (
	food: FoodItem,
	category: ResolvedFoodCategory,
): FoodItem => ({
	...food,
	foodCategory: category.label,
	categories: mergeCanonicalFoodCategories(category.label, food.categories),
	categoryOptionId: category.categoryOptionId,
	symbolKey: category.symbolKey ?? "generic",
});

const resolveSourceFoodCategoryOption = async (
	supabase: SupabaseClient<Database>,
	sourceValues: string[],
): Promise<ResolvedFoodCategory | null> => {
	const normalizedValues = [
		...new Set(sourceValues.map(normalizeFoodCategoryValue).filter(Boolean)),
	];
	if (!normalizedValues.length) return null;

	const { data, error } = await supabase.rpc(
		"resolve_custom_food_category_option_with_symbol",
		{ p_source_values: sourceValues },
	);
	if (error) throw error;
	const resolved = data?.[0];
	if (!resolved) return null;

	return {
		categoryOptionId: resolved.category_option_id,
		label: resolved.category_option_label,
		sourceValue: resolved.source_normalized_value,
		confidence: resolved.confidence,
		symbolKey: resolved.symbol_key,
	};
};

export const resolveFoodCategoryOption = async (
	supabase: SupabaseClient<Database>,
	sourceValues: string[],
): Promise<ResolvedFoodCategory | null> =>
	resolveSourceFoodCategoryOption(supabase, sourceValues);

export const readFoodCategoryOption = async (
	supabase: SupabaseClient<Database>,
	categoryOptionId: string | null | undefined,
): Promise<ResolvedFoodCategory | null> => {
	if (!categoryOptionId) return null;
	const { data, error } = await supabase
		.from("custom_food_category_options")
		.select("id, label, normalized_value, symbol_key, updated_at")
		.eq("id", categoryOptionId)
		.eq("enabled", true)
		.maybeSingle();
	if (error) throw error;
	if (!data) return null;
	return {
		categoryOptionId: data.id,
		label: data.label,
		sourceValue: data.normalized_value,
		confidence: "exact",
		symbolKey: data.symbol_key,
		updatedAt: data.updated_at,
	};
};

export const readFoodCategoryOptions = async (
	supabase: SupabaseClient<Database>,
	categoryOptionIds: Array<string | null | undefined>,
	databaseAbortSignal?: AbortSignal,
) => {
	const ids = [
		...new Set(categoryOptionIds.filter((id): id is string => Boolean(id))),
	];
	if (!ids.length) return new Map<string, ResolvedFoodCategory>();
	const databaseQuery = supabase
		.from("custom_food_category_options")
		.select("id, label, normalized_value, symbol_key, updated_at")
		.in("id", ids)
		.eq("enabled", true);
	const { data, error } = await applyDatabaseQueryAbortSignal(
		databaseQuery,
		databaseAbortSignal,
	);
	if (error) throw error;
	return new Map(
		(data ?? []).map((row) => [
			row.id,
			{
				categoryOptionId: row.id,
				label: row.label,
				sourceValue: row.normalized_value,
				confidence: "exact",
				symbolKey: row.symbol_key,
				updatedAt: row.updated_at,
			} satisfies ResolvedFoodCategory,
		]),
	);
};

export const resolveBarcodeDraftCategory = async (
	supabase: SupabaseClient<Database>,
	draft: BarcodeProductDraft,
): Promise<BarcodeProductDraft> => {
	if (draft.categoryResolution) return draft;
	const sourceValues = draft.categories ?? [];
	const resolved = await resolveFoodCategoryOption(supabase, sourceValues);
	if (!resolved) return draft;

	return {
		...draft,
		resolvedCategory: resolved.label,
		categoryResolution: {
			categoryOptionId: resolved.categoryOptionId,
			label: resolved.label,
			sourceValue: resolved.sourceValue,
			confidence: resolved.confidence,
			symbolKey: resolved.symbolKey,
		},
	};
};
