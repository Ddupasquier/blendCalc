import type { FoodItem } from "$lib/utils/food/types";
import { resolveFoodIdentityType } from "$lib/utils/food/identity/foodIdentity";

export type NutritionCompletenessProfileScope =
	| "generic"
	| "manual"
	| "packaged";
export type NutritionCompletenessScope =
	| NutritionCompletenessProfileScope
	| "unknown";
export type NutritionRequirementLevel = "required" | "recommended";

export type NutritionCompletenessNutrient = {
	nutrientId: number;
	label: string;
	unitName: string;
	requirementLevel: NutritionRequirementLevel;
	displayOrder: number;
	reason: string;
};

export type NutritionCompletenessProfile = {
	key: string;
	displayName: string;
	foodScope: NutritionCompletenessProfileScope;
	regionCode: string;
	completeLabel: string;
	resolvedLabel: string;
	partialLabel: string;
	limitedLabel: string;
	description: string;
	sourceKey: string;
	sourceReference: string;
	isDefault: boolean;
	nutrients: NutritionCompletenessNutrient[];
};

export type ProductRegulatoryDisclosureProfile = {
	key: string;
	displayName: string;
	userDescription: string;
	disclosureKind:
		| "standard-nutrition"
		| "regulated-alcohol"
		| "permitted-sparse"
		| "case-specific"
		| "unknown";
	nutritionEvaluationMode: "profile" | "sparse-accepted" | "case-specific" | "unknown";
	nutritionProfileKey: string | null;
	regionCode: string;
	authorityName: string;
	requiresAlcoholByVolume: boolean;
	requiresModeratorReview: boolean;
	userSelectable: boolean;
	sourceReference: string;
	sortOrder: number;
	isDefault: boolean;
};

export type NutritionCompletenessCatalog = {
	profiles: NutritionCompletenessProfile[];
	regulatoryDisclosureProfiles?: ProductRegulatoryDisclosureProfile[];
};

let configuredCatalog: NutritionCompletenessCatalog = { profiles: [] };

export const configureNutritionCompletenessCatalog = (
	catalog: NutritionCompletenessCatalog | null | undefined,
) => {
	configuredCatalog = catalog ?? { profiles: [] };
};

export const getNutritionCompletenessScope = (
	food: Pick<
		FoodItem,
		| "barcode"
		| "gtinUpc"
		| "dataType"
		| "sourceDataType"
		| "foodIdentityType"
		| "customFood"
		| "brandOwner"
		| "trustStatus"
	>,
): NutritionCompletenessScope => {
	if (
		food.trustStatus === "user-private" ||
		(food.customFood === true && !food.trustStatus)
	) {
		return "manual";
	}

	const identityType = resolveFoodIdentityType(food);
	return identityType === "private-custom" ? "manual" : identityType;
};

export const getNutritionCompletenessProfile = (
	food: FoodItem,
	catalog: NutritionCompletenessCatalog = configuredCatalog,
) => {
	const disclosureProfile = getProductRegulatoryDisclosureProfile(
		food.regulatoryDisclosure?.profileKey,
		catalog,
	);
	if (disclosureProfile) {
		if (disclosureProfile.nutritionEvaluationMode !== "profile") return null;
		return catalog.profiles.find(
			(profile) => profile.key === disclosureProfile.nutritionProfileKey,
		) ?? null;
	}

	const scope = getNutritionCompletenessScope(food);
	if (scope === "unknown") return null;
	const scopedProfiles = catalog.profiles.filter(
		(profile) => profile.foodScope === scope,
	);

	return scopedProfiles.find(
		(profile) =>
			profile.isDefault &&
			profile.regionCode === (scope === "packaged" ? "US" : ""),
	) ??
		scopedProfiles.find((profile) => profile.isDefault) ??
		scopedProfiles[0] ??
		null;
};

export const getProductRegulatoryDisclosureProfile = (
	profileKey: string | null | undefined,
	catalog: NutritionCompletenessCatalog = configuredCatalog,
) =>
	catalog.regulatoryDisclosureProfiles?.find(
		(profile) => profile.key === profileKey,
	) ?? null;

export const getRegulatedAlcoholDisclosureProfileForFood = (
	food: Pick<FoodItem, "alcoholByVolume" | "regulatoryDisclosure">,
	catalog: NutritionCompletenessCatalog = configuredCatalog,
) => {
	const selectedProfile = getProductRegulatoryDisclosureProfile(
		food.regulatoryDisclosure?.profileKey,
		catalog,
	);
	if (selectedProfile?.disclosureKind === "regulated-alcohol") {
		return selectedProfile;
	}

	const alcoholByVolume = food.alcoholByVolume;
	if (
		!alcoholByVolume ||
		alcoholByVolume.valueStatus !== "reported" ||
		!Number.isFinite(alcoholByVolume.percent) ||
		alcoholByVolume.percent <= 0
	) {
		return null;
	}

	return catalog.regulatoryDisclosureProfiles?.find(
		(profile) => profile.disclosureKind === "regulated-alcohol",
	) ?? null;
};
