import { throwAppError } from "$lib/server/errors/appError.server";
import type { Database } from "$lib/types/database.types";
import {
	parseCatalogReviewWorkSummary,
	type CatalogReviewWorkSummary,
} from "$lib/utils/moderation/catalogReviewWork";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_REVIEW_LIMIT = 20;

export const readCatalogReviewWork = async (
	supabase: SupabaseClient<Database>,
): Promise<CatalogReviewWorkSummary> => {
	const { data, error } = await supabase.rpc(
		"get_catalog_review_work_summary",
		{
			p_limit: DEFAULT_REVIEW_LIMIT,
		},
	);

	if (error || data === null) {
		throwAppError(502, "MODERATION_DATA_UNAVAILABLE");
	}

	try {
		return parseCatalogReviewWorkSummary(data);
	} catch {
		return throwAppError(502, "MODERATION_DATA_UNAVAILABLE");
	}
};
