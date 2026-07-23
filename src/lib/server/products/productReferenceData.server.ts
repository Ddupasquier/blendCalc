import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { createServerCachedLoader } from "$lib/server/cache/serverCachedLoader";
import { readProductReferenceData } from "$lib/utils/food/reference/productReferenceData";

const CACHE_DURATION_MILLISECONDS = 10 * 60 * 1000;

export const getProductReferenceData = createServerCachedLoader({
	load: () => readProductReferenceData(getSupabaseAdminClient()),
	ttlMilliseconds: CACHE_DURATION_MILLISECONDS,
});
