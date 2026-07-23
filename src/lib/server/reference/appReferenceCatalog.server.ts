import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { readAppReferenceCatalog } from "$lib/utils/food/reference/appReferenceData";
import { createServerCachedLoader } from "$lib/server/cache/serverCachedLoader";
import { getNutrientDefinitionCatalog } from "$lib/server/nutrition/nutrientDefinitionCatalog.server";

export const getAppReferenceCatalog = createServerCachedLoader({
	load: async () =>
		readAppReferenceCatalog(
			getSupabaseAdminClient(),
			await getNutrientDefinitionCatalog(),
		),
});
