export type NutrientCatalogItem = {
	id: number;
	label: string;
	unit: string;
	nutrientNumber: string;
};

export type NutrientDisplayField = NutrientCatalogItem & {
	sortOrder: number;
	highlight: boolean;
	defaultGoal: number | null;
};

export type NutrientDisplayProfile = {
	key: string;
	displayName: string;
	purpose: "nutrition_facts" | "mix_default" | "mix_popular";
	version: number;
	fields: NutrientDisplayField[];
};

export type NutrientEquivalence = {
	canonicalNutrientId: number;
	sourceNutrientId: number | null;
	sourceNutrientNumber: string | null;
	sourceKey: string;
};

export type MixGoalTemplate = {
	id: string;
	label: string;
	description: string;
	goals: Record<number, number>;
};

export type MixRuntimeConfiguration = {
	defaultGoalByUnit: Record<string, number>;
	progressThresholds: {
		atGoal: number;
		barelyOver: number;
		midwayOver: number;
	};
	pointGoalTolerance: number;
	defaultServingGrams: number;
};

export type FoodSymbolDefinition = {
	key: string;
	label: string;
};

export type AppReferenceCatalog = {
	nutrients: NutrientCatalogItem[];
	nutrientDisplayProfiles: NutrientDisplayProfile[];
	nutrientEquivalences: NutrientEquivalence[];
	mixGoalTemplates: MixGoalTemplate[];
	mixRuntime: MixRuntimeConfiguration;
	foodSymbols: FoodSymbolDefinition[];
};

const EMPTY_MIX_RUNTIME: MixRuntimeConfiguration = {
	defaultGoalByUnit: {},
	progressThresholds: {
		atGoal: 0,
		barelyOver: 0,
		midwayOver: 0,
	},
	pointGoalTolerance: 0,
	defaultServingGrams: 0,
};

const EMPTY_CATALOG: AppReferenceCatalog = {
	nutrients: [],
	nutrientDisplayProfiles: [],
	nutrientEquivalences: [],
	mixGoalTemplates: [],
	mixRuntime: EMPTY_MIX_RUNTIME,
	foodSymbols: [],
};

let configuredCatalog = EMPTY_CATALOG;

export const configureAppReferenceCatalog = (
	catalog: AppReferenceCatalog | null | undefined,
) => {
	configuredCatalog = catalog ?? EMPTY_CATALOG;
};

export const getConfiguredAppReferenceCatalog = () => configuredCatalog;

export const getNutrientDisplayProfile = (
	purpose: NutrientDisplayProfile["purpose"],
	catalog: AppReferenceCatalog = configuredCatalog,
) => catalog.nutrientDisplayProfiles.find((profile) => profile.purpose === purpose) ?? null;

export const getNutritionFactsFields = (
	catalog: AppReferenceCatalog = configuredCatalog,
) => getNutrientDisplayProfile("nutrition_facts", catalog)?.fields ?? [];

export const getDefaultMixFields = (
	catalog: AppReferenceCatalog = configuredCatalog,
) => getNutrientDisplayProfile("mix_default", catalog)?.fields ?? [];

export const getPopularMixFields = (
	catalog: AppReferenceCatalog = configuredCatalog,
) => getNutrientDisplayProfile("mix_popular", catalog)?.fields ?? [];

export const getDefaultMixGoals = (
	catalog: AppReferenceCatalog = configuredCatalog,
) => Object.fromEntries(
	getDefaultMixFields(catalog).flatMap((field) =>
		field.defaultGoal === null ? [] : [[field.id, field.defaultGoal]],
	),
);

export const getMixRuntimeConfiguration = (
	catalog: AppReferenceCatalog = configuredCatalog,
) => {
	if (catalog.mixRuntime.defaultServingGrams <= 0) {
		throw new Error("The app reference catalog has not been configured.");
	}
	return catalog.mixRuntime;
};

export const getMixGoalTemplates = (
	catalog: AppReferenceCatalog = configuredCatalog,
) => catalog.mixGoalTemplates;

export const getNutrientCatalog = (
	catalog: AppReferenceCatalog = configuredCatalog,
) => catalog.nutrients;

export const getFoodSymbolDefinition = (
	key: string | null | undefined,
	catalog: AppReferenceCatalog = configuredCatalog,
) =>
	catalog.foodSymbols.find((symbol) => symbol.key === key) ??
	catalog.foodSymbols.find((symbol) => symbol.key === "generic") ??
	null;
