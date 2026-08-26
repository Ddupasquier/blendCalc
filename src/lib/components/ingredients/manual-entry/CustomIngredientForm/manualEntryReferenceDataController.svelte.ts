import { emptyManualEntryNutrientGroups } from "$lib/components/ingredients/manual-entry/formTypes";
import {
	getManualEntryReferenceDataAvailabilityMessages,
	loadManualEntryReferenceData,
} from "$lib/utils/food/nutrients/manualEntryReferenceData";
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

		try {
			const referenceData = await loadManualEntryReferenceData();
			if (generation !== loadGeneration) return;
			const messages =
				getManualEntryReferenceDataAvailabilityMessages(referenceData);

			state.nutrientGroups = referenceData.nutrientGroups;
			state.nutrientError = messages.nutrientGroupError;
			state.nutrientRelationshipRules = referenceData.nutrientRelationshipRules;
			state.nutrientRelationshipRuleError =
				messages.nutrientRelationshipRuleError;
			state.nutritionLabelOcrMappings = referenceData.nutritionLabelOcrMappings;
			state.nutritionLabelOcrMappingError =
				messages.nutritionLabelOcrMappingError;
			state.regulatoryDisclosureProfiles =
				referenceData.regulatoryDisclosureProfiles;
			state.regulatoryDisclosureProfileError =
				messages.regulatoryDisclosureProfileError;
		} catch (error) {
			if (generation !== loadGeneration) return;
			if (import.meta.env.DEV) {
				console.error("Unable to load manual entry reference data", error);
			}
			const messages = getManualEntryReferenceDataAvailabilityMessages(null);
			state.nutrientGroups = emptyManualEntryNutrientGroups;
			state.nutrientError = messages.nutrientGroupError;
			state.nutrientRelationshipRules = [];
			state.nutrientRelationshipRuleError =
				messages.nutrientRelationshipRuleError;
			state.nutritionLabelOcrMappings = [];
			state.nutritionLabelOcrMappingError =
				messages.nutritionLabelOcrMappingError;
			state.regulatoryDisclosureProfiles = [];
			state.regulatoryDisclosureProfileError =
				messages.regulatoryDisclosureProfileError;
		} finally {
			if (generation === loadGeneration) {
				state.loadingNutrients = false;
				state.loadingNutrientRelationshipRules = false;
			}
		}
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
