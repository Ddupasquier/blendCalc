import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { readAppReferenceCatalog } from "$lib/utils/food/reference/appReferenceData";
import { createServerCachedLoader } from "$lib/server/cache/serverCachedLoader";

export const getAppReferenceCatalog = createServerCachedLoader({
	load: () => readAppReferenceCatalog(getSupabaseAdminClient()),
});
