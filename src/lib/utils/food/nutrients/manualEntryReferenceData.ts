import {
	readCustomFoodCategoryOptions,
	type CustomFoodCategoryOption,
} from "$lib/utils/food/nutrients/categoryOptions";
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
	categoryOptions: CustomFoodCategoryOption[];
	categoryOptionsError: string;
	nutrientRelationshipRules: NutrientRelationshipRule[];
	nutrientRelationshipRuleError: string;
	nutritionLabelOcrMappings: NutritionLabelOcrMapping[];
	nutritionLabelOcrMappingError: string;
};

export const loadManualEntryReferenceData =
	async (): Promise<ManualEntryReferenceData> => {
		const [
			nutrientGroupsResult,
			categoryOptionsResult,
			relationshipRulesResult,
			nutritionLabelOcrMappingsResult,
		] =
			await Promise.allSettled([
				readManualEntryNutrientGroups(),
				readCustomFoodCategoryOptions(),
				readNutrientRelationshipRules(getSupabaseBrowserClient()),
				readNutritionLabelOcrMappings(getSupabaseBrowserClient()),
			]);

		const nutrientGroups =
			nutrientGroupsResult.status === "fulfilled"
				? nutrientGroupsResult.value
				: null;
		const categoryOptions =
			categoryOptionsResult.status === "fulfilled"
				? categoryOptionsResult.value
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
			categoryOptions: categoryOptions ?? [],
			categoryOptionsError: categoryOptions?.length
				? ""
				: "Food categories are not available yet. Run the category seed script after database migrations.",
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
