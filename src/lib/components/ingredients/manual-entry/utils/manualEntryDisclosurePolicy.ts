import type { ProductRegulatoryDisclosureProfile } from "$lib/utils/food/quality/nutritionCompletenessCatalog";

export type ManualEntryDisclosurePolicy = {
	profile: ProductRegulatoryDisclosureProfile | null;
	requiresStandardNutrition: boolean;
	allowsMissingServingWeight: boolean;
	requiresAlcoholByVolume: boolean;
};

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
