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
	emoji: string;
};

export type FoodSymbolCategoryRule = {
	symbolKey: string;
	matchPattern: string;
	priority: number;
};

export type FoodSymbolSubject = {
	symbolKey?: string;
	description?: string;
	foodCategory?: string;
	brandedFoodCategory?: string;
	categories?: string[];
};

export type FoodPreferenceConflictRule = {
	preferenceSlug: string;
	preferenceLabel: string;
	factSlug: string;
	factLabel: string;
	level: "warning" | "potential";
};

export type FoodCompatibilityMatchRule = {
	sourceKey: string | null;
	fieldName: "description" | "food_category" | "ingredients";
	matchPattern: string;
	tagSlug: string;
	tagLabel: string;
	tagCategory: "allergen" | "dietary" | "ingredient" | "avoidance";
	factType: "ingredient_present";
	sourceType: "label_ingredient_field" | "source_food_identity";
	confidence: "confirmed" | "inferred" | "uncertain";
	priority: number;
};

export type AppReferenceCatalog = {
	nutrients: NutrientCatalogItem[];
	nutrientDisplayProfiles: NutrientDisplayProfile[];
	nutrientEquivalences: NutrientEquivalence[];
	mixGoalTemplates: MixGoalTemplate[];
	mixRuntime: MixRuntimeConfiguration;
	foodSymbols: FoodSymbolDefinition[];
	foodSymbolCategoryRules: FoodSymbolCategoryRule[];
	foodPreferenceConflictRules: FoodPreferenceConflictRule[];
	foodCompatibilityMatchRules: FoodCompatibilityMatchRule[];
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
	foodSymbolCategoryRules: [],
	foodPreferenceConflictRules: [],
	foodCompatibilityMatchRules: [],
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

const matchesFoodSymbolRule = (value: string, matchPattern: string) => {
	try {
		return new RegExp(matchPattern, "i").test(value);
	} catch {
		return false;
	}
};

export const resolveFoodSymbolKey = (
	food: FoodSymbolSubject,
	catalog: AppReferenceCatalog = configuredCatalog,
) => {
	if (
		food.symbolKey &&
		food.symbolKey !== "generic" &&
		catalog.foodSymbols.some((symbol) => symbol.key === food.symbolKey)
	) {
		return food.symbolKey;
	}

	const categoryText = [
		food.foodCategory,
		food.brandedFoodCategory,
		...(food.categories ?? []),
		food.description,
	]
		.filter(Boolean)
		.join(" ");
	const matchedRule = [...(catalog.foodSymbolCategoryRules ?? [])]
		.sort((left, right) => left.priority - right.priority)
		.find((rule) => matchesFoodSymbolRule(categoryText, rule.matchPattern));

	return matchedRule?.symbolKey ?? "generic";
};
