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

export type NutritionCompletenessCatalog = {
	profiles: NutritionCompletenessProfile[];
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
