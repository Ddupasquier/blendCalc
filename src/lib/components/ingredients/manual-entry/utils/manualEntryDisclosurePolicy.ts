import type { ProductRegulatoryDisclosureProfile } from "$lib/utils/food/quality/nutritionCompletenessCatalog";
import type {
	ManualEntryNutrientDefinition,
	ManualEntryNutrientGroup,
} from "$lib/utils/food/nutrients/nutrientDefinitions";

export type ManualEntryDisclosurePolicy = {
	profile: ProductRegulatoryDisclosureProfile | null;
	requiresStandardNutrition: boolean;
	allowsMissingServingWeight: boolean;
	requiresAlcoholByVolume: boolean;
};

export type ManualEntryNutritionFieldPolicy = {
	requiresNutritionFields: boolean;
	helper: string;
};

const barcodeNutritionHelper =
	"Values marked From barcode were supplied by the accepted product source and are already included. Not provided means that source did not report a value in that group; those fields stay blank unless you enter what the package reports. A reported 0 remains 0.";

export const getManualEntryDisclosurePolicy = ({
	profileKey,
	profiles,
}: {
	profileKey: string | undefined;
	profiles: ProductRegulatoryDisclosureProfile[];
}): ManualEntryDisclosurePolicy => {
	const profile =
		profiles.find((candidate) => candidate.key === profileKey) ?? null;
	const requiresStandardNutrition =
		!profile || profile.nutritionEvaluationMode === "profile";

	return {
		profile,
		requiresStandardNutrition,
		allowsMissingServingWeight: !requiresStandardNutrition,
		requiresAlcoholByVolume: profile?.requiresAlcoholByVolume ?? false,
	};
};

export const getManualEntryNutritionFieldPolicy = ({
	shareWithCatalog,
	usesInternal100GramBasis,
	disclosurePolicy,
}: {
	shareWithCatalog: boolean;
	usesInternal100GramBasis: boolean;
	disclosurePolicy: ManualEntryDisclosurePolicy;
}): ManualEntryNutritionFieldPolicy => {
	const blankAndZeroGuidance =
		"Leave a field blank when the label does not list it, and enter 0 only when the label reports zero.";

	if (shareWithCatalog && disclosurePolicy.requiresStandardNutrition) {
		return {
			requiresNutritionFields: true,
			helper: `To share this standard label, enter every value marked *. ${blankAndZeroGuidance}`,
		};
	}

	if (disclosurePolicy.requiresStandardNutrition) {
		return {
			requiresNutritionFields: false,
			helper: `Nutrition is optional for a private save. Enter only values the package reports. ${blankAndZeroGuidance}`,
		};
	}

	return {
		requiresNutritionFields: false,
		helper: usesInternal100GramBasis
			? `This label may legally omit standard nutrition. Imported values stay on their reported per-100g basis. Add package values only after entering the package's exact gram serving. ${blankAndZeroGuidance}`
			: `This label may legally omit standard nutrition. Enter only values the package reports. ${blankAndZeroGuidance}`,
	};
};

export const getManualEntryNutritionStepHelper = ({
	hasAcceptedBarcodeSource,
	fallback,
}: {
	hasAcceptedBarcodeSource: boolean;
	fallback: string;
}) => (hasAcceptedBarcodeSource ? barcodeNutritionHelper : fallback);

export const getManualEntryNutrientGroupBadge = ({
	group,
	hasAcceptedBarcodeSource,
	reportedNutrientIds,
	isRequired,
}: {
	group: ManualEntryNutrientGroup;
	hasAcceptedBarcodeSource: boolean;
	reportedNutrientIds: number[];
	isRequired: (field: ManualEntryNutrientDefinition) => boolean;
}) => {
	if (hasAcceptedBarcodeSource) {
		const reportedIds = new Set(reportedNutrientIds);
		return group.fields.some((field) => reportedIds.has(field.nutrientId))
			? "From barcode"
			: "Not provided";
	}

	return group.fields.every((field) => !isRequired(field))
		? "Optional"
		: "Required to share";
};
