import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { completeServerBackgroundTask } from "$lib/server/runtime/backgroundTask.server";
import type { Json } from "$lib/types/database.types";
import type { ProductSourceQualitySummary } from "$lib/utils/food/sources/sourceQuality";

export type ProductSourceLookupKind = "barcode" | "generic-search";
export type ProductSourceLookupOutcome = "matched" | "not-found" | "error";

export type ProductSourceFieldMetricIncrement = {
	sourceKey: "usda" | "open-food-facts";
	fieldPath: string;
	evaluatedCount?: number;
	selectedCount?: number;
	internallyInvalidCount?: number;
	crossSourceDisagreementCount?: number;
	submittedLabelDisagreementCount?: number;
	confirmedLabelCorrectionCount?: number;
};

export type ProductSourceRequestTrace = {
	apiRequestCount: number;
	apiErrorCount: number;
	cacheHitCount: number;
	cacheMissCount: number;
	staleFallbackCount: number;
	coalescedRequestCount: number;
};

export const createProductSourceRequestTrace =
	(): ProductSourceRequestTrace => ({
		apiRequestCount: 0,
		apiErrorCount: 0,
		cacheHitCount: 0,
		cacheMissCount: 0,
		staleFallbackCount: 0,
		coalescedRequestCount: 0,
	});

export const recordProductSourceApiRequest = (
	trace?: ProductSourceRequestTrace,
) => {
	if (trace) trace.apiRequestCount += 1;
};

export const recordProductSourceApiError = (
	trace?: ProductSourceRequestTrace,
) => {
	if (trace) trace.apiErrorCount += 1;
};

export const recordProductSourceCacheHit = (
	trace?: ProductSourceRequestTrace,
) => {
	if (trace) trace.cacheHitCount += 1;
};

export const recordProductSourceCacheMiss = (
	trace?: ProductSourceRequestTrace,
) => {
	if (trace) trace.cacheMissCount += 1;
};

export const recordProductSourceStaleFallback = (
	trace?: ProductSourceRequestTrace,
) => {
	if (trace) trace.staleFallbackCount += 1;
};

export const recordProductSourceCoalescedRequest = (
	trace?: ProductSourceRequestTrace,
) => {
	if (trace) trace.coalescedRequestCount += 1;
};

export const recordProductSourceLookup = async (input: {
	sourceKey: string;
	sourceDataType?: string;
	lookupKind: ProductSourceLookupKind;
	outcome: ProductSourceLookupOutcome;
	startedAt: number;
	trace: ProductSourceRequestTrace;
	quality?: ProductSourceQualitySummary;
	exactBarcodeMatch?: boolean;
}) => {
	await completeServerBackgroundTask(writeProductSourceLookup(input));
};

export const recordProductSourceFieldMetrics = async (
	increments: readonly ProductSourceFieldMetricIncrement[],
) => {
	const combined = new Map<
		string,
		Required<ProductSourceFieldMetricIncrement>
	>();
	for (const increment of increments) {
		const fieldPath = increment.fieldPath.trim();
		if (!fieldPath) continue;
		const key = `${increment.sourceKey}:${fieldPath}`;
		const current = combined.get(key) ?? {
			sourceKey: increment.sourceKey,
			fieldPath,
			evaluatedCount: 0,
			selectedCount: 0,
			internallyInvalidCount: 0,
			crossSourceDisagreementCount: 0,
			submittedLabelDisagreementCount: 0,
			confirmedLabelCorrectionCount: 0,
		};
		current.evaluatedCount += increment.evaluatedCount ?? 0;
		current.selectedCount += increment.selectedCount ?? 0;
		current.internallyInvalidCount += increment.internallyInvalidCount ?? 0;
		current.crossSourceDisagreementCount +=
			increment.crossSourceDisagreementCount ?? 0;
		current.submittedLabelDisagreementCount +=
			increment.submittedLabelDisagreementCount ?? 0;
		current.confirmedLabelCorrectionCount +=
			increment.confirmedLabelCorrectionCount ?? 0;
		combined.set(key, current);
	}
	if (combined.size === 0) return;

	await completeServerBackgroundTask(
		writeProductSourceFieldMetrics([...combined.values()]),
	);
};

const writeProductSourceFieldMetrics = async (
	increments: readonly Required<ProductSourceFieldMetricIncrement>[],
) => {
	try {
		const { error } = await getSupabaseAdminClient().rpc(
			"record_product_source_field_daily_metrics",
			{
				p_metric_increments: increments.map((increment) => ({
					source_key: increment.sourceKey,
					field_path: increment.fieldPath,
					evaluated_count: increment.evaluatedCount,
					selected_count: increment.selectedCount,
					internally_invalid_count: increment.internallyInvalidCount,
					cross_source_disagreement_count:
						increment.crossSourceDisagreementCount,
					submitted_label_disagreement_count:
						increment.submittedLabelDisagreementCount,
					confirmed_label_correction_count:
						increment.confirmedLabelCorrectionCount,
				})) as Json,
			},
		);
		if (error) throw error;
	} catch (error) {
		console.warn(
			"Unable to record product source field metrics:",
			error instanceof Error ? error.message : error,
		);
	}
};

const writeProductSourceLookup = async (input: {
	sourceKey: string;
	sourceDataType?: string;
	lookupKind: ProductSourceLookupKind;
	outcome: ProductSourceLookupOutcome;
	startedAt: number;
	trace: ProductSourceRequestTrace;
	quality?: ProductSourceQualitySummary;
	exactBarcodeMatch?: boolean;
}) => {
	const matched = input.outcome === "matched";
	const completed = input.outcome !== "error";
	const quality = matched ? input.quality : undefined;

	try {
		const { error } = await getSupabaseAdminClient().rpc(
			"record_product_source_daily_metric",
			{
				p_source_key: input.sourceKey,
				p_source_data_type: input.sourceDataType ?? "",
				p_lookup_kind: input.lookupKind,
				p_lookup_origin: "runtime",
				p_lookup_count: 1,
				p_api_request_count: input.trace.apiRequestCount,
				p_api_error_count: input.trace.apiErrorCount,
				p_cache_hit_count: input.trace.cacheHitCount,
				p_cache_miss_count: input.trace.cacheMissCount,
				p_stale_fallback_count: input.trace.staleFallbackCount,
				p_coalesced_request_count: input.trace.coalescedRequestCount,
				p_completed_lookup_count: completed ? 1 : 0,
				p_match_count: matched ? 1 : 0,
				p_exact_barcode_match_count: matched && input.exactBarcodeMatch ? 1 : 0,
				p_error_count: input.outcome === "error" ? 1 : 0,
				p_evaluated_product_count: quality ? 1 : 0,
				p_reported_nutrient_total: quality?.reportedNutrientCount ?? 0,
				p_brand_present_count: quality?.hasBrand ? 1 : 0,
				p_category_present_count: quality?.hasCategory ? 1 : 0,
				p_serving_present_count: quality?.hasServing ? 1 : 0,
				p_ingredients_present_count: quality?.hasIngredients ? 1 : 0,
				p_image_present_count: quality?.hasImage ? 1 : 0,
				p_response_milliseconds_total: Math.max(
					0,
					Date.now() - input.startedAt,
				),
			},
		);
		if (error) throw error;
	} catch (error) {
		console.warn(
			`Unable to record ${input.sourceKey} source metrics:`,
			error instanceof Error ? error.message : error,
		);
	}
};
