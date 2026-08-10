import { createServerCachedLoader } from "$lib/server/cache/serverCachedLoader";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { NutrientDefinitionReferenceRecord } from "$lib/utils/food/nutrients/nutrientDefinitionRecord";

const CACHE_DURATION_MILLISECONDS = 10 * 60 * 1000;

export const getNutrientDefinitionCatalog = createServerCachedLoader({
	load: async (): Promise<NutrientDefinitionReferenceRecord[]> => {
		const { data, error } = await getSupabaseAdminClient()
			.from("nutrient_definitions")
			.select(
				"nutrient_id, nutrient_name, nutrient_number, default_unit_name",
			);
		if (error) throw error;
		return data ?? [];
	},
	ttlMilliseconds: CACHE_DURATION_MILLISECONDS,
});
