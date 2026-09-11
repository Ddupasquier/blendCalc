import { throwAppError } from "$lib/server/errors/appError.server";
import type { Database } from "$lib/types/database.types";
import {
	parseCatalogProductReadinessPassport,
	parseCatalogProductRevisionHistory,
	type CatalogProductReadinessPassport,
} from "$lib/utils/moderation/catalogProductReadinessPassport";
import type { SupabaseClient } from "@supabase/supabase-js";

export const readCatalogProductReadinessPassport = async (
	supabase: SupabaseClient<Database>,
	sharedProductId: string,
): Promise<CatalogProductReadinessPassport> => {
	const [passportResult, revisionHistoryResult] = await Promise.all([
		supabase.rpc("get_blendcalc_api_catalog_product_readiness_passport", {
			p_shared_product_id: sharedProductId,
		}),
		supabase.rpc("get_catalog_product_revision_context", {
			p_shared_product_id: sharedProductId,
		}),
	]);
	const { data, error } = passportResult;

	if (error?.code === "P0002") {
		throwAppError(404, "PRODUCT_NOT_FOUND");
	}
	if (
		error ||
		data === null ||
		revisionHistoryResult.error ||
		revisionHistoryResult.data === null
	) {
		throwAppError(502, "MODERATION_DATA_UNAVAILABLE");
	}

	try {
		return {
			...parseCatalogProductReadinessPassport(data),
			revisionHistory: parseCatalogProductRevisionHistory(
				revisionHistoryResult.data,
			),
		};
	} catch {
		return throwAppError(502, "MODERATION_DATA_UNAVAILABLE");
	}
};
