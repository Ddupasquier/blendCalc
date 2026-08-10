import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { readAppReferenceCatalog } from "$lib/utils/food/reference/appReferenceCatalogReader";
import { createServerCachedLoader } from "$lib/server/cache/serverCachedLoader";
import { getNutrientDefinitionCatalog } from "$lib/server/nutrition/nutrientDefinitionCatalog.server";

const CACHE_DURATION_MILLISECONDS = 10 * 60 * 1000;

export const getAppReferenceCatalog = createServerCachedLoader({
	load: async () =>
		readAppReferenceCatalog(
			getSupabaseAdminClient(),
			await getNutrientDefinitionCatalog(),
		),
	ttlMilliseconds: CACHE_DURATION_MILLISECONDS,
});
