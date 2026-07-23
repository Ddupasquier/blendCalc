import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { createServerCachedLoader } from "$lib/server/cache/serverCachedLoader";
import { readServingMeasureCatalog } from "$lib/utils/serving/servingMeasureData";

const CACHE_DURATION_MILLISECONDS = 10 * 60 * 1000;

export const getServingMeasureCatalog = createServerCachedLoader({
	load: () => readServingMeasureCatalog(getSupabaseAdminClient()),
	ttlMilliseconds: CACHE_DURATION_MILLISECONDS,
});
