import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { createServerCachedLoader } from "$lib/server/cache/serverCachedLoader";
import { readNutritionCompletenessCatalog } from "$lib/utils/food/quality/nutritionCompletenessData";
import { readProductRegulatoryDisclosureProfiles } from "$lib/utils/food/quality/productRegulatoryDisclosureProfiles";
import { getNutrientDefinitionCatalog } from "./nutrientDefinitionCatalog.server";
import { isProductResolutionPolicySchemaUnavailable } from "$lib/server/products/productResolutionPolicy.server";

const CACHE_DURATION_MILLISECONDS = 10 * 60 * 1000;

const readCurrentNutritionCompletenessCatalog = createServerCachedLoader({
	load: async () =>
		readNutritionCompletenessCatalog(
			getSupabaseAdminClient(),
			await getNutrientDefinitionCatalog(),
		),
	ttlMilliseconds: CACHE_DURATION_MILLISECONDS,
});

let temporaryRolloutCatalog: Awaited<
	ReturnType<typeof readNutritionCompletenessCatalog>
> | null = null;
let temporaryRolloutCatalogExpiresAt = 0;

export const getNutritionCompletenessCatalog = async () => {
	if (
		temporaryRolloutCatalogExpiresAt > Date.now() &&
		temporaryRolloutCatalog
	) {
		return temporaryRolloutCatalog;
	}

	try {
		const catalog = await readCurrentNutritionCompletenessCatalog();
		temporaryRolloutCatalog = null;
		temporaryRolloutCatalogExpiresAt = 0;
		return catalog;
	} catch (error) {
		if (
			!isProductResolutionPolicySchemaUnavailable(
				error as {
					code?: string;
					message?: string;
				},
			)
		) {
			throw error;
		}

		temporaryRolloutCatalog = {
			profiles: [],
			regulatoryDisclosureProfiles:
				await readProductRegulatoryDisclosureProfiles(getSupabaseAdminClient()),
		};
		temporaryRolloutCatalogExpiresAt = Date.now() + 30 * 1000;
		return temporaryRolloutCatalog;
	}
};
