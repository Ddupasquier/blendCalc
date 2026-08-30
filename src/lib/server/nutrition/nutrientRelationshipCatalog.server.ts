import { createServerCachedLoader } from "$lib/server/cache/serverCachedLoader";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { readNutrientRelationshipRules } from "$lib/utils/food/nutrients/nutrientRelationshipRules";

const CACHE_DURATION_MILLISECONDS = 10 * 60 * 1000;

export const getNutrientRelationshipRuleCatalog = createServerCachedLoader({
	load: async () => {
		const rules = await readNutrientRelationshipRules(getSupabaseAdminClient());
		if (!rules?.length) {
			throw new Error("Nutrient relationship rules are unavailable.");
		}
		return rules;
	},
	ttlMilliseconds: CACHE_DURATION_MILLISECONDS,
});
