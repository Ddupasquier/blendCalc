import {
	readManualEntryNutrientGroups,
	type ManualEntryNutrientGroupsByStep,
} from "$lib/utils/food/nutrients/nutrientDefinitions";
import {
	readNutrientRelationshipRules,
	type NutrientRelationshipRule,
} from "$lib/utils/food/nutrients/nutrientRelationshipRules";
import { getSupabaseBrowserClient } from "$lib/supabase/client";
import {
	readNutritionLabelOcrMappings,
	type NutritionLabelOcrMapping,
} from "$lib/utils/food/ocr/nutritionLabelOcrMappings";
import { readProductRegulatoryDisclosureProfiles } from "$lib/utils/food/quality/productRegulatoryDisclosureProfiles";
import type { ProductRegulatoryDisclosureProfile } from "$lib/utils/food/quality/nutritionCompletenessCatalog";

export type ManualEntryReferenceData = {
	nutrientGroups: ManualEntryNutrientGroupsByStep | null;
	nutrientGroupError: string;
	nutrientRelationshipRules: NutrientRelationshipRule[];
	nutrientRelationshipRuleError: string;
	nutritionLabelOcrMappings: NutritionLabelOcrMapping[];
	nutritionLabelOcrMappingError: string;
	regulatoryDisclosureProfiles: ProductRegulatoryDisclosureProfile[];
	regulatoryDisclosureProfileError: string;
};

export const loadManualEntryReferenceData =
	async (): Promise<ManualEntryReferenceData> => {
		const [
			nutrientGroupsResult,
			relationshipRulesResult,
			nutritionLabelOcrMappingsResult,
			regulatoryDisclosureProfilesResult,
		] =
			await Promise.allSettled([
				readManualEntryNutrientGroups(),
				readNutrientRelationshipRules(getSupabaseBrowserClient()),
				readNutritionLabelOcrMappings(getSupabaseBrowserClient()),
				readProductRegulatoryDisclosureProfiles(getSupabaseBrowserClient()),
			]);

		const nutrientGroups =
			nutrientGroupsResult.status === "fulfilled"
				? nutrientGroupsResult.value
				: null;
		const nutrientRelationshipRules =
			relationshipRulesResult.status === "fulfilled"
				? relationshipRulesResult.value
				: null;
		const nutritionLabelOcrMappings =
			nutritionLabelOcrMappingsResult.status === "fulfilled"
				? nutritionLabelOcrMappingsResult.value
				: null;
		const regulatoryDisclosureProfiles =
			regulatoryDisclosureProfilesResult.status === "fulfilled"
				? regulatoryDisclosureProfilesResult.value.filter(
					(profile) => profile.userSelectable,
				)
				: null;

		return {
			nutrientGroups,
			nutrientGroupError: nutrientGroups
				? ""
				: "Nutrition fields could not load. Refresh and try again before continuing.",
			nutrientRelationshipRules: nutrientRelationshipRules ?? [],
			nutrientRelationshipRuleError: nutrientRelationshipRules?.length
				? ""
				: "Nutrition validation rules could not be loaded. Try again in a moment.",
			nutritionLabelOcrMappings: nutritionLabelOcrMappings ?? [],
			nutritionLabelOcrMappingError: nutritionLabelOcrMappings?.length
				? ""
				: "Nutrition label scanning is unavailable. Enter the label values manually.",
			regulatoryDisclosureProfiles: regulatoryDisclosureProfiles ?? [],
			regulatoryDisclosureProfileError: regulatoryDisclosureProfiles?.length
				? ""
				: "Package label options could not load. You can still save this ingredient and add the context later.",
		};
	};
