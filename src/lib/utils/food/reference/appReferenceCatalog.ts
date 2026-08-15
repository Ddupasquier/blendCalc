import type { MixGoalMap, MixGoalTemplate } from "$lib/utils/mix/goals/types";

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

export type { MixGoalTemplate };

export type MixRuntimeConfiguration = {
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
	familyKey: string;
};

export type FoodSymbolRuleScope =
	| "prepared_override"
	| "category"
	| "name_refinement"
	| "uncategorized_name";

export type FoodSymbolResolutionRule = {
	symbolKey: string;
	matchPattern: string;
	priority: number;
	matchScopes: FoodSymbolRuleScope[];
};

export type FoodSymbolSubject = {
	symbolKey?: string;
	description?: string;
	canonicalDescription?: string;
	foodCategory?: string;
	brandedFoodCategory?: string;
	categories?: string[];
};

export type AppDelightMessage = {
	key: string;
	contextKey: "app" | "ingredients" | "mix" | "saved";
	triggerKey: string;
	matchKey: string | null;
	message: string;
	minimumValue: number | null;
	maximumValue: number | null;
	priority: number;
};

export type AppReferenceCatalog = {
	nutrients: NutrientCatalogItem[];
	nutrientDisplayProfiles: NutrientDisplayProfile[];
	nutrientEquivalences: NutrientEquivalence[];
	mixGoalTemplates: MixGoalTemplate[];
	mixRuntime: MixRuntimeConfiguration;
	foodSymbols: FoodSymbolDefinition[];
	foodSymbolResolutionRules: FoodSymbolResolutionRule[];
	delightMessages: AppDelightMessage[];
};

const EMPTY_MIX_RUNTIME: MixRuntimeConfiguration = {
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
	foodSymbolResolutionRules: [],
	delightMessages: [],
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
) =>
  catalog.nutrientDisplayProfiles.find(
    (profile) => profile.purpose === purpose,
  ) ?? null;

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
) => ({ ...(getDefaultMixGoalTemplate(catalog)?.goals ?? {}) }) as MixGoalMap;

export const getDefaultMixGoalTemplate = (
  catalog: AppReferenceCatalog = configuredCatalog,
) => catalog.mixGoalTemplates.find((template) => template.isDefault) ?? null;

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

const compileFoodSymbolRulePattern = (matchPattern: string) => {
	try {
		return new RegExp(matchPattern, "i");
	} catch {
		return null;
	}
};

const normalizeFoodSymbolCategoryText = (value: string) =>
	value.replaceAll("&", " and ").replace(/\s+/g, " ").trim();

type IndexedFoodSymbolResolutionRule = {
	rule: FoodSymbolResolutionRule;
	matcher: RegExp | null;
};

type FoodSymbolResolutionIndex = {
	sortedRules: IndexedFoodSymbolResolutionRule[];
	symbolFamilyByKey: ReadonlyMap<string, string>;
};

const foodSymbolResolutionIndexes = new WeakMap<
	AppReferenceCatalog,
	FoodSymbolResolutionIndex
>();

const getFoodSymbolResolutionIndex = (
	catalog: AppReferenceCatalog,
): FoodSymbolResolutionIndex => {
	const existingIndex = foodSymbolResolutionIndexes.get(catalog);
	if (existingIndex) return existingIndex;

	const index = {
		sortedRules: [...(catalog.foodSymbolResolutionRules ?? [])]
			.sort((left, right) => left.priority - right.priority)
			.map((rule) => ({
				rule,
				matcher: compileFoodSymbolRulePattern(rule.matchPattern),
			})),
		symbolFamilyByKey: new Map(
			catalog.foodSymbols.map((symbol) => [symbol.key, symbol.familyKey]),
		),
	};
	foodSymbolResolutionIndexes.set(catalog, index);
	return index;
};

const findMatchingFoodSymbolRule = (
	value: string,
	rules: readonly IndexedFoodSymbolResolutionRule[],
	scope: FoodSymbolRuleScope,
	allowedFamilyKey: string | null,
	symbolFamilyByKey: ReadonlyMap<string, string>,
) =>
	rules.find(({ rule, matcher }) => {
		if (!rule.matchScopes.includes(scope)) return false;
		if (!matcher?.test(value)) return false;
		if (!allowedFamilyKey) return true;
		return symbolFamilyByKey.get(rule.symbolKey) === allowedFamilyKey;
	})?.rule;

export const resolveFoodSymbolKey = (
	food: FoodSymbolSubject,
	catalog: AppReferenceCatalog = configuredCatalog,
) => {
	const nameText = [food.canonicalDescription, food.description]
		.filter(Boolean)
		.join(" ");
	const categoryText = [
		food.foodCategory,
		food.brandedFoodCategory,
		...(food.categories ?? []),
	]
		.filter(Boolean)
		.join(" ");
	const normalizedCategoryText = normalizeFoodSymbolCategoryText(categoryText);
	const { sortedRules, symbolFamilyByKey } =
		getFoodSymbolResolutionIndex(catalog);
	const preparedRule = findMatchingFoodSymbolRule(
		nameText,
		sortedRules,
		"prepared_override",
		null,
		symbolFamilyByKey,
	);
	if (preparedRule) return preparedRule.symbolKey;

	const categoryRule = findMatchingFoodSymbolRule(
		normalizedCategoryText,
		sortedRules,
		"category",
		null,
		symbolFamilyByKey,
	);
	if (categoryRule) {
		const categoryFamilyKey = symbolFamilyByKey.get(categoryRule.symbolKey);
		const nameRule = categoryFamilyKey
			? findMatchingFoodSymbolRule(
					nameText,
					sortedRules,
					"name_refinement",
					categoryFamilyKey,
					symbolFamilyByKey,
				)
			: null;
		return nameRule?.symbolKey ?? categoryRule.symbolKey;
	}

	const uncategorizedNameRule = findMatchingFoodSymbolRule(
		nameText,
		sortedRules,
		"uncategorized_name",
		null,
		symbolFamilyByKey,
	);
	if (uncategorizedNameRule) return uncategorizedNameRule.symbolKey;

	if (
		food.symbolKey &&
		food.symbolKey !== "generic" &&
		catalog.foodSymbols.some((symbol) => symbol.key === food.symbolKey)
	) {
		return food.symbolKey;
	}

	return "generic";
};
