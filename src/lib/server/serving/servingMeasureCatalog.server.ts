import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { readServingMeasureCatalog } from "$lib/utils/serving/servingMeasureData";
import type { ServingMeasureCatalog } from "$lib/utils/serving/servingMeasureCatalog";

const CACHE_DURATION_MILLISECONDS = 10 * 60 * 1000;

let cachedCatalog: ServingMeasureCatalog | null = null;
let cacheExpiresAt = 0;
let pendingCatalog: Promise<ServingMeasureCatalog> | null = null;

export const getServingMeasureCatalog = async () => {
	const now = Date.now();
	if (cachedCatalog && cacheExpiresAt > now) return cachedCatalog;
	if (pendingCatalog) return pendingCatalog;

	pendingCatalog = readServingMeasureCatalog(getSupabaseAdminClient())
		.then((catalog) => {
			cachedCatalog = catalog;
			cacheExpiresAt = Date.now() + CACHE_DURATION_MILLISECONDS;
			return catalog;
		})
		.finally(() => {
			pendingCatalog = null;
		});

	return pendingCatalog;
};
