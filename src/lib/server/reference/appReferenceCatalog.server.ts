import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { AppReferenceCatalog } from "$lib/utils/food/reference/appReferenceCatalog";
import { readAppReferenceCatalog } from "$lib/utils/food/reference/appReferenceData";

let cachedCatalog: AppReferenceCatalog | null = null;
let pendingCatalog: Promise<AppReferenceCatalog> | null = null;

export const getAppReferenceCatalog = async () => {
	if (cachedCatalog) return cachedCatalog;
	if (pendingCatalog) return pendingCatalog;

	pendingCatalog = readAppReferenceCatalog(getSupabaseAdminClient())
		.then((catalog) => {
			cachedCatalog = catalog;
			return catalog;
		})
		.finally(() => {
			pendingCatalog = null;
		});

	return pendingCatalog;
};

export const clearAppReferenceCatalogCache = () => {
	cachedCatalog = null;
	pendingCatalog = null;
};
