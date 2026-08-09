import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { createServerCachedLoader } from "$lib/server/cache/serverCachedLoader";
import { readProductReferenceCatalog } from "$lib/utils/food/reference/productReferenceCatalog";
import { getNutrientDefinitionCatalog } from "$lib/server/nutrition/nutrientDefinitionCatalog.server";

const CACHE_DURATION_MILLISECONDS = 10 * 60 * 1000;

export const getProductReferenceCatalog = createServerCachedLoader({
	load: async () =>
		readProductReferenceCatalog(
			getSupabaseAdminClient(),
			await getNutrientDefinitionCatalog(),
		),
	ttlMilliseconds: CACHE_DURATION_MILLISECONDS,
});
