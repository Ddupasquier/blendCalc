import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { readNutritionCompletenessCatalog } from "$lib/utils/food/quality/nutritionCompletenessData";
import type { NutritionCompletenessCatalog } from "$lib/utils/food/quality/nutritionCompletenessCatalog";

const CACHE_DURATION_MILLISECONDS = 10 * 60 * 1000;

let cachedCatalog: NutritionCompletenessCatalog | null = null;
let cacheExpiresAt = 0;
let pendingCatalog: Promise<NutritionCompletenessCatalog> | null = null;

export const getNutritionCompletenessCatalog = async () => {
	const now = Date.now();
	if (cachedCatalog && cacheExpiresAt > now) return cachedCatalog;
	if (pendingCatalog) return pendingCatalog;

	pendingCatalog = readNutritionCompletenessCatalog(getSupabaseAdminClient())
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
