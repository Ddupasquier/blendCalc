import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { completeServerBackgroundTask } from "$lib/server/runtime/backgroundTask.server";
import type { ProductSourceQualitySummary } from "$lib/utils/food/sources/sourceQuality";

export type ProductSourceLookupKind = "barcode" | "generic-search";
export type ProductSourceLookupOutcome = "matched" | "not-found" | "error";

export type ProductSourceRequestTrace = {
	apiRequestCount: number;
	apiErrorCount: number;
	cacheHitCount: number;
};

export const createProductSourceRequestTrace = (): ProductSourceRequestTrace => ({
	apiRequestCount: 0,
	apiErrorCount: 0,
	cacheHitCount: 0,
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
				p_completed_lookup_count: completed ? 1 : 0,
				p_match_count: matched ? 1 : 0,
				p_exact_barcode_match_count:
					matched && input.exactBarcodeMatch ? 1 : 0,
				p_error_count: input.outcome === "error" ? 1 : 0,
				p_evaluated_product_count: quality ? 1 : 0,
				p_reported_nutrient_total: quality?.reportedNutrientCount ?? 0,
				p_brand_present_count: quality?.hasBrand ? 1 : 0,
				p_category_present_count: quality?.hasCategory ? 1 : 0,
				p_serving_present_count: quality?.hasServing ? 1 : 0,
				p_ingredients_present_count: quality?.hasIngredients ? 1 : 0,
				p_image_present_count: quality?.hasImage ? 1 : 0,
				p_response_milliseconds_total: Math.max(0, Date.now() - input.startedAt),
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
