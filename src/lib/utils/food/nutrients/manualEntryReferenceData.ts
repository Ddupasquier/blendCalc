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

export type ManualEntryReferenceData = {
	nutrientGroups: ManualEntryNutrientGroupsByStep | null;
	nutrientGroupError: string;
	nutrientRelationshipRules: NutrientRelationshipRule[];
	nutrientRelationshipRuleError: string;
	nutritionLabelOcrMappings: NutritionLabelOcrMapping[];
	nutritionLabelOcrMappingError: string;
};

export const loadManualEntryReferenceData =
	async (): Promise<ManualEntryReferenceData> => {
		const [
			nutrientGroupsResult,
			relationshipRulesResult,
			nutritionLabelOcrMappingsResult,
		] =
			await Promise.allSettled([
				readManualEntryNutrientGroups(),
				readNutrientRelationshipRules(getSupabaseBrowserClient()),
				readNutritionLabelOcrMappings(getSupabaseBrowserClient()),
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
		};
	};
