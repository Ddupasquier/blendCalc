import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { createServerCachedLoader } from "$lib/server/cache/serverCachedLoader";
import { readNutritionCompletenessCatalog } from "$lib/utils/food/quality/nutritionCompletenessData";

const CACHE_DURATION_MILLISECONDS = 10 * 60 * 1000;

export const getNutritionCompletenessCatalog = createServerCachedLoader({
	load: () => readNutritionCompletenessCatalog(getSupabaseAdminClient()),
	ttlMilliseconds: CACHE_DURATION_MILLISECONDS,
});
