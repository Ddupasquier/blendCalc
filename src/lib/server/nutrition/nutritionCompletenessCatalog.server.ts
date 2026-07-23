import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { createServerCachedLoader } from "$lib/server/cache/serverCachedLoader";
import { readNutritionCompletenessCatalog } from "$lib/utils/food/quality/nutritionCompletenessData";
import { getNutrientDefinitionCatalog } from "./nutrientDefinitionCatalog.server";

const CACHE_DURATION_MILLISECONDS = 10 * 60 * 1000;

export const getNutritionCompletenessCatalog = createServerCachedLoader({
	load: async () =>
		readNutritionCompletenessCatalog(
			getSupabaseAdminClient(),
			await getNutrientDefinitionCatalog(),
		),
	ttlMilliseconds: CACHE_DURATION_MILLISECONDS,
});
