import { type ManualEntryNutrientGroupsByStep } from "$lib/utils/food/nutrients/nutrientDefinitions";
import { type NutrientRelationshipRule } from "$lib/utils/food/nutrients/nutrientRelationshipRules";
import { type NutritionLabelOcrMapping } from "$lib/utils/food/ocr/nutritionLabelOcrMappings";
import type { ProductRegulatoryDisclosureProfile } from "$lib/utils/food/quality/nutritionCompletenessCatalog";
import { createUserFacingErrorFromResponse } from "$lib/utils/errors/userFacingErrors";

export type ManualEntryReferenceData = {
	nutrientGroups: ManualEntryNutrientGroupsByStep;
	nutrientRelationshipRules: NutrientRelationshipRule[];
	nutritionLabelOcrMappings: NutritionLabelOcrMapping[];
	regulatoryDisclosureProfiles: ProductRegulatoryDisclosureProfile[];
};

export type ManualEntryReferenceDataAvailabilityMessages = {
	nutrientGroupError: string;
	nutrientRelationshipRuleError: string;
	nutritionLabelOcrMappingError: string;
	regulatoryDisclosureProfileError: string;
};

export const MANUAL_ENTRY_REFERENCE_DATA_UNAVAILABLE_MESSAGE =
	"Nutrition tools couldn’t load. Refresh and try again before continuing.";

const isManualEntryReferenceData = (
	value: unknown,
): value is ManualEntryReferenceData => {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<ManualEntryReferenceData>;
	return (
		Boolean(candidate.nutrientGroups) &&
		Array.isArray(candidate.nutrientGroups?.macros) &&
		Array.isArray(candidate.nutrientGroups?.extended) &&
		Array.isArray(candidate.nutrientRelationshipRules) &&
		Array.isArray(candidate.nutritionLabelOcrMappings) &&
		Array.isArray(candidate.regulatoryDisclosureProfiles)
	);
};

export const getManualEntryReferenceDataAvailabilityMessages = (
	referenceData: ManualEntryReferenceData | null,
): ManualEntryReferenceDataAvailabilityMessages => {
	if (!referenceData) {
		return {
			nutrientGroupError: MANUAL_ENTRY_REFERENCE_DATA_UNAVAILABLE_MESSAGE,
			nutrientRelationshipRuleError: "",
			nutritionLabelOcrMappingError: "",
			regulatoryDisclosureProfileError: "",
		};
	}

	return {
		nutrientGroupError: "",
		nutrientRelationshipRuleError: "",
		nutritionLabelOcrMappingError:
			referenceData.nutritionLabelOcrMappings.length > 0
				? ""
				: "Nutrition label scanning is unavailable. Enter the label values manually.",
		regulatoryDisclosureProfileError:
			referenceData.regulatoryDisclosureProfiles.length > 0
				? ""
				: "Package label options could not load. You can still save this ingredient and add the context later.",
	};
};

export const loadManualEntryReferenceData = async (
	fetchRequest: typeof fetch = fetch,
): Promise<ManualEntryReferenceData> => {
	const response = await fetchRequest("/api/manual-entry/reference-data", {
		headers: { accept: "application/json" },
	});
	if (!response.ok) {
		throw await createUserFacingErrorFromResponse(
			response,
			"SERVICE_UNAVAILABLE",
		);
	}

	const referenceData: unknown = await response.json();
	if (!isManualEntryReferenceData(referenceData)) {
		throw new Error("Manual entry reference data response was invalid.");
	}
	return referenceData;
};
