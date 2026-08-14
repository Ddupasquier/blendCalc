import { emptyManualEntryNutrientGroups } from "$lib/components/ingredients/manual-entry/formTypes";
import { loadManualEntryReferenceData } from "$lib/utils/food/nutrients/manualEntryReferenceData";
import type { NutrientRelationshipRule } from "$lib/utils/food/nutrients/nutrientRelationshipRules";
import type { NutritionLabelOcrMapping } from "$lib/utils/food/ocr/nutritionLabelOcr";
import type { ProductRegulatoryDisclosureProfile } from "$lib/utils/food/quality/nutritionCompletenessCatalog";

export const createManualEntryReferenceDataController = () => {
	const state = $state({
		nutrientGroups: emptyManualEntryNutrientGroups,
		loadingNutrients: false,
		nutrientError: "",
		nutrientRelationshipRules: [] as NutrientRelationshipRule[],
		loadingNutrientRelationshipRules: false,
		nutrientRelationshipRuleError: "",
		nutritionLabelOcrMappings: [] as NutritionLabelOcrMapping[],
		nutritionLabelOcrMappingError: "",
		regulatoryDisclosureProfiles: [] as ProductRegulatoryDisclosureProfile[],
		regulatoryDisclosureProfileError: "",
	});
	let loadGeneration = 0;

	const load = async () => {
		const generation = ++loadGeneration;
		state.loadingNutrients = true;
		state.loadingNutrientRelationshipRules = true;
		state.nutrientError = "";
		state.nutrientRelationshipRuleError = "";

		const referenceData = await loadManualEntryReferenceData();
		if (generation !== loadGeneration) return;

		state.nutrientGroups =
			referenceData.nutrientGroups ?? emptyManualEntryNutrientGroups;
		state.nutrientError = referenceData.nutrientGroupError;
		state.nutrientRelationshipRules =
			referenceData.nutrientRelationshipRules;
		state.nutrientRelationshipRuleError =
			referenceData.nutrientRelationshipRuleError;
		state.nutritionLabelOcrMappings =
			referenceData.nutritionLabelOcrMappings;
		state.nutritionLabelOcrMappingError =
			referenceData.nutritionLabelOcrMappingError;
		state.regulatoryDisclosureProfiles =
			referenceData.regulatoryDisclosureProfiles;
		state.regulatoryDisclosureProfileError =
			referenceData.regulatoryDisclosureProfileError;
		state.loadingNutrients = false;
		state.loadingNutrientRelationshipRules = false;
	};

	const destroy = () => {
		loadGeneration += 1;
	};

	return {
		state,
		load,
		destroy,
	};
};

export type ManualEntryReferenceDataController = ReturnType<
	typeof createManualEntryReferenceDataController
>;
