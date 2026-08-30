import { createServerCachedLoader } from "$lib/server/cache/serverCachedLoader";
import { getNutrientRelationshipRuleCatalog } from "$lib/server/nutrition/nutrientRelationshipCatalog.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { readManualEntryNutrientGroups } from "$lib/utils/food/nutrients/nutrientDefinitions";
import type { ManualEntryReferenceData } from "$lib/utils/food/nutrients/manualEntryReferenceData";
import { readNutritionLabelOcrMappings } from "$lib/utils/food/ocr/nutritionLabelOcrMappings";
import { readProductRegulatoryDisclosureProfiles } from "$lib/utils/food/quality/productRegulatoryDisclosureProfiles";

const CACHE_DURATION_MILLISECONDS = 10 * 60 * 1000;

export const getManualEntryReferenceData = createServerCachedLoader({
	load: async (): Promise<ManualEntryReferenceData> => {
		const supabase = getSupabaseAdminClient();
		const [
			nutrientGroups,
			nutrientRelationshipRules,
			nutritionLabelOcrMappings,
			regulatoryDisclosureProfiles,
		] = await Promise.all([
			readManualEntryNutrientGroups(supabase),
			getNutrientRelationshipRuleCatalog(),
			readNutritionLabelOcrMappings(supabase),
			readProductRegulatoryDisclosureProfiles(supabase),
		]);

		if (!nutrientGroups || !nutrientRelationshipRules?.length) {
			throw new Error("Required manual entry reference data is unavailable.");
		}

		return {
			nutrientGroups,
			nutrientRelationshipRules,
			nutritionLabelOcrMappings: nutritionLabelOcrMappings ?? [],
			regulatoryDisclosureProfiles: regulatoryDisclosureProfiles.filter(
				(profile) => profile.userSelectable,
			),
		};
	},
	ttlMilliseconds: CACHE_DURATION_MILLISECONDS,
});
