import type { FdcFood } from "$lib/utils/food/types";

export type NutritionCompletenessScope = "generic" | "manual" | "packaged";
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
	foodScope: NutritionCompletenessScope;
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

export const getConfiguredNutritionCompletenessCatalog = () => configuredCatalog;

export const getNutritionCompletenessScope = (
	food: Pick<
		FdcFood,
		| "barcode"
		| "gtinUpc"
		| "dataType"
		| "sourceDataType"
		| "customFood"
		| "trustStatus"
	>,
): NutritionCompletenessScope => {
	if (
		food.trustStatus === "user-private" ||
		(food.customFood === true && !food.trustStatus)
	) {
		return "manual";
	}

	const dataType = `${food.dataType ?? ""} ${food.sourceDataType ?? ""}`.toLowerCase();
	return food.barcode || food.gtinUpc || dataType.includes("branded")
		? "packaged"
		: "generic";
};

export const getNutritionCompletenessProfile = (
	food: FdcFood,
	catalog: NutritionCompletenessCatalog = configuredCatalog,
) => {
	const scope = getNutritionCompletenessScope(food);
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
