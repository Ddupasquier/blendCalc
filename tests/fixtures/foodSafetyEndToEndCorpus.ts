import type {
	FoodCompatibilityIngredientAlias,
	FoodCompatibilityMatchRule,
	FoodPreferenceConflictRule,
	FoodSafetyPolicy,
} from "$lib/server/food-safety/foodSafetyPolicy.server";
import type { OpenFoodFactsProduct } from "$lib/utils/barcode/barcodeProductMappers";
import type { CustomFoodInput } from "$lib/utils/food/custom/customFoods";
import type { FdcFood } from "$lib/utils/food/types";

export type FoodSafetyCorpusStage =
	| "provider-normalization"
	| "ingredient-extraction"
	| "precautionary-preservation"
	| "multilingual-matching"
	| "policy-evaluation"
	| "api-serialization"
	| "user-message";

type FoodSafetyCorpusExpectation = {
	status: "checked" | "conflict" | "incomplete";
	warningLabels: string[];
	contains?: string[];
	mayContain?: string[];
	precautionaryTypes?: string[];
};

type FoodSafetyCorpusBase = {
	id: string;
	name: string;
	preferences: {
		allergens?: string[];
		dietaryRestrictions?: string[];
	};
	expected: FoodSafetyCorpusExpectation;
	stages: FoodSafetyCorpusStage[];
	features: string[];
};

export type FoodSafetyCorpusCase = FoodSafetyCorpusBase & (
	| {
		kind: "open-food-facts";
		barcode: string;
		product: OpenFoodFactsProduct;
	}
	| {
		kind: "private-custom";
		food: CustomFoodInput;
	}
	| {
		kind: "generic";
		food: FdcFood;
	}
);

const defaultStages: FoodSafetyCorpusStage[] = [
	"provider-normalization",
	"ingredient-extraction",
	"policy-evaluation",
	"api-serialization",
	"user-message",
];

const syntheticProduct = (
	name: string,
	overrides: OpenFoodFactsProduct,
): OpenFoodFactsProduct => ({
	product_name: name,
	brands: "Synthetic QA Foods",
	serving_size: "100 g",
	nutriments: { "energy-kcal_100g": 100 },
	lang: "en",
	...overrides,
});

const createOpenFoodFactsCase = (
	input: Omit<
		Extract<FoodSafetyCorpusCase, { kind: "open-food-facts" }>,
		"kind" | "barcode" | "stages"
	> & { stages?: FoodSafetyCorpusStage[] },
): FoodSafetyCorpusCase => ({
	...input,
	kind: "open-food-facts",
	barcode: "4006381333931",
	stages: input.stages ?? defaultStages,
});

const aliasDefinitions = [
	["milk", "Milk", "milk", "en"],
	["milk", "Milk", "lait", "fr"],
	["milk", "Milk", "lait ecreme", "fr"],
	["milk", "Milk", "leche", "es"],
	["egg", "Egg", "egg", "en"],
	["egg", "Egg", "eggs", "en"],
	["peanut", "Peanut", "peanut", "en"],
	["peanut", "Peanut", "peanuts", "en"],
	["soy", "Soy", "soy", "en"],
	["soy", "Soy", "soybean", "en"],
	["wheat", "Wheat", "wheat", "en"],
	["sesame", "Sesame", "sesame", "en"],
	["tree-nut", "Tree Nut", "tree nut", "en"],
	["tree-nut", "Tree Nut", "tree nuts", "en"],
	["tree-nut", "Tree Nut", "almond", "en"],
	["shellfish", "Shellfish", "crustaceans", "en"],
	["shellfish", "Shellfish", "crustaceos", "es"],
] as const;

const ingredientAliases: FoodCompatibilityIngredientAlias[] =
	aliasDefinitions.map(([tagSlug, tagLabel, alias, languageCode], index) => ({
		ingredientTermId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
		termKey: alias.replace(/\s+/g, "-"),
		termLabel: alias,
		alias,
		normalizedAlias: alias,
		languageCode,
		tagSlug,
		tagLabel,
		tagCategory: "allergen",
		preferenceRuleType: "allergen",
	}));

const createConflictRule = (
	preferenceSlug: string,
	preferenceLabel: string,
	factSlug: string,
	priority: number,
	preferenceCategory: FoodPreferenceConflictRule["preferenceCategory"] = "allergen",
): FoodPreferenceConflictRule => ({
	preferenceSlug,
	preferenceLabel,
	preferenceCategory,
	factSlug,
	factLabel: factSlug,
	level: "warning",
	warningCode: "FOOD_RESTRICTION_CONFLICT",
	priority,
});

const allergenConflictRules = [
	["milk", "Milk"],
	["egg", "Egg"],
	["peanut", "Peanut"],
	["soy", "Soy"],
	["wheat", "Wheat"],
	["sesame", "Sesame"],
	["tree-nut", "Tree Nut"],
	["shellfish", "Shellfish"],
] as const;

const preferenceConflictRules: FoodPreferenceConflictRule[] = [
	...allergenConflictRules.map(([slug, label], index) =>
		createConflictRule(slug, label, slug, index)
	),
	...[
		["vegan", "Vegan", "meat"],
		["vegan", "Vegan", "milk"],
		["vegan", "Vegan", "egg"],
		["vegetarian", "Vegetarian", "meat"],
		["vegetarian", "Vegetarian", "gelatin"],
		["gluten-free", "Gluten-free", "wheat"],
	].map(([slug, label, fact], index) =>
		createConflictRule(slug, label, fact, index, "dietary")
	),
];

const compatibilityMatchRules: FoodCompatibilityMatchRule[] = [
	{
		sourceKey: null,
		fieldName: "ingredients",
		matchPattern: "\\bbeef\\b",
		excludePattern: null,
		tagSlug: "meat",
		tagLabel: "Meat",
		tagCategory: "avoidance",
		factType: "dietary_conflict",
		sourceType: "label_ingredient_field",
		confidence: "confirmed",
		priority: 10,
	},
	{
		sourceKey: null,
		fieldName: "ingredients",
		matchPattern: "\\bgelatin\\b",
		excludePattern: null,
		tagSlug: "gelatin",
		tagLabel: "Gelatin",
		tagCategory: "avoidance",
		factType: "dietary_conflict",
		sourceType: "label_ingredient_field",
		confidence: "confirmed",
		priority: 20,
	},
	{
		sourceKey: "usda",
		fieldName: "generic_food_identity",
		matchPattern: "\\bshrimp\\b",
		excludePattern: null,
		tagSlug: "shellfish",
		tagLabel: "Shellfish",
		tagCategory: "allergen",
		factType: "contains",
		sourceType: "food_identity_taxonomy",
		confidence: "confirmed",
		priority: 30,
	},
];

export const FOOD_SAFETY_END_TO_END_POLICY: FoodSafetyPolicy = {
	version: 2,
	reviewedAt: "2026-07-31T16:40:00.000Z",
	preferenceConflictRules,
	compatibilityMatchRules,
	regionalProfiles: [],
	ingredientAliases,
	policyExemptions: [],
	supportedIngredientLanguages: ["en", "fr", "es"],
};

export const FOOD_SAFETY_END_TO_END_CORPUS: FoodSafetyCorpusCase[] = [
	createOpenFoodFactsCase({
		id: "explicit-contains",
		name: "An explicit allergen declaration survives intake",
		product: syntheticProduct("Synthetic cocoa bites", {
			ingredients_text: "Cocoa, sugar. Contains: milk and egg.",
		}),
		preferences: { allergens: ["Milk", "Egg"] },
		expected: {
			status: "conflict",
			warningLabels: ["Milk", "Egg"],
			contains: ["Milk", "Egg"],
		},
		features: ["explicit-contains", "provider-label-text"],
	}),
	createOpenFoodFactsCase({
		id: "may-contain",
		name: "A may-contain declaration remains precautionary",
		product: syntheticProduct("Synthetic fruit chews", {
			ingredients_text: "Fruit puree, sugar. May contain: peanuts.",
		}),
		preferences: { allergens: ["Peanut"] },
		expected: {
			status: "conflict",
			warningLabels: ["Peanut"],
			mayContain: ["Peanut"],
			precautionaryTypes: ["may_contain"],
		},
		stages: [...defaultStages, "precautionary-preservation"],
		features: ["may-contain", "exact-precautionary-text"],
	}),
	createOpenFoodFactsCase({
		id: "shared-equipment",
		name: "Shared-equipment wording retains its statement type",
		product: syntheticProduct("Synthetic rice crackers", {
			ingredients_text:
				"Rice, salt. Made on shared equipment that also processes sesame.",
		}),
		preferences: { allergens: ["Sesame"] },
		expected: {
			status: "conflict",
			warningLabels: ["Sesame"],
			mayContain: ["Sesame"],
			precautionaryTypes: ["shared_equipment"],
		},
		stages: [...defaultStages, "precautionary-preservation"],
		features: ["shared-equipment", "exact-precautionary-text"],
	}),
	createOpenFoodFactsCase({
		id: "shared-facility",
		name: "Shared-facility wording retains its statement type",
		product: syntheticProduct("Synthetic corn crisps", {
			ingredients_text:
				"Corn, salt. Produced in a facility that also handles peanuts.",
		}),
		preferences: { allergens: ["Peanut"] },
		expected: {
			status: "conflict",
			warningLabels: ["Peanut"],
			mayContain: ["Peanut"],
			precautionaryTypes: ["shared_facility"],
		},
		stages: [...defaultStages, "precautionary-preservation"],
		features: ["shared-facility", "exact-precautionary-text"],
	}),
	createOpenFoodFactsCase({
		id: "nested-ingredient",
		name: "Nested structured ingredients remain available to matching",
		product: syntheticProduct("Synthetic chocolate cup", {
			ingredients_text: "Chocolate filling, cocoa shell",
			ingredients: [{
				id: "en:chocolate-filling",
				text: "Chocolate filling",
				ingredients: [{ id: "en:milk", text: "Milk" }],
			}],
			allergens_tags: ["en:milk"],
		}),
		preferences: { allergens: ["Milk"] },
		expected: {
			status: "conflict",
			warningLabels: ["Milk"],
			contains: ["Milk"],
		},
		features: ["nested-ingredient", "structured-tree"],
	}),
	createOpenFoodFactsCase({
		id: "french-ingredient",
		name: "Reviewed French ingredient terminology resolves canonically",
		product: syntheticProduct("Synthetic French cereal", {
			ingredients_text: "Lait écrémé, avoine",
			ingredients: [{ id: "fr:lait-ecreme", text: "Lait écrémé" }],
			lang: "fr",
		}),
		preferences: { allergens: ["Milk"] },
		expected: { status: "conflict", warningLabels: ["Milk"] },
		stages: [...defaultStages, "multilingual-matching"],
		features: ["french", "accent-normalization"],
	}),
	createOpenFoodFactsCase({
		id: "spanish-allergen",
		name: "Reviewed Spanish allergen terminology resolves canonically",
		product: syntheticProduct("Synthetic Spanish soup", {
			ingredients_text: "Agua, sal",
			allergens_tags: ["es:crustáceos"],
			lang: "es",
		}),
		preferences: { allergens: ["Shellfish"] },
		expected: {
			status: "conflict",
			warningLabels: ["Shellfish"],
			contains: ["Crustáceos"],
		},
		stages: [...defaultStages, "multilingual-matching"],
		features: ["spanish", "accent-normalization"],
	}),
	createOpenFoodFactsCase({
		id: "unsupported-language",
		name: "Unsupported label language remains incomplete instead of guessed",
		product: syntheticProduct("Synthetic German cereal", {
			ingredients_text: "Milch, Hafer",
			allergens_tags: ["en:soy"],
			traces_tags: ["en:sesame"],
			lang: "de",
		}),
		preferences: { allergens: ["Peanut"] },
		expected: { status: "incomplete", warningLabels: [] },
		stages: [...defaultStages, "multilingual-matching"],
		features: ["unsupported-language", "incomplete"],
	}),
	createOpenFoodFactsCase({
		id: "eggplant-negative-control",
		name: "Eggplant never becomes egg evidence",
		product: syntheticProduct("Synthetic vegetable bowl", {
			ingredients_text: "Eggplant, tomato, basil",
			ingredients: [{ id: "en:eggplant", text: "Eggplant" }],
			allergens_tags: ["en:soy"],
			traces_tags: ["en:sesame"],
		}),
		preferences: { allergens: ["Egg"] },
		expected: { status: "checked", warningLabels: [] },
		features: ["negative-control", "token-boundary"],
	}),
	createOpenFoodFactsCase({
		id: "almond-milk-negative-control",
		name: "Almond milk never becomes dairy evidence",
		product: syntheticProduct("Synthetic almond beverage", {
			ingredients_text: "Almond milk, water",
			ingredients: [{ id: "en:almond-milk", text: "Almond milk" }],
			allergens_tags: ["en:tree-nuts"],
			traces_tags: ["en:sesame"],
		}),
		preferences: { allergens: ["Milk"] },
		expected: { status: "checked", warningLabels: [] },
		features: ["negative-control", "compound-term"],
	}),
	createOpenFoodFactsCase({
		id: "dietary-conflict",
		name: "Ingredient evidence overrides a conflicting vegan source claim",
		product: syntheticProduct("Synthetic savory pie", {
			ingredients_text: "Beef, flour, salt",
			labels_tags: ["en:vegan"],
			allergens_tags: ["en:wheat"],
			traces_tags: ["en:sesame"],
		}),
		preferences: { dietaryRestrictions: ["Vegan"] },
		expected: { status: "conflict", warningLabels: ["Vegan"] },
		features: ["dietary-conflict", "claim-conflict"],
	}),
	createOpenFoodFactsCase({
		id: "gluten-conflict",
		name: "Wheat ingredient evidence conflicts with gluten-free settings",
		product: syntheticProduct("Synthetic wheat crackers", {
			ingredients_text: "Wheat flour, water, salt",
			ingredients: [{ id: "en:wheat-flour", text: "Wheat flour" }],
			allergens_tags: ["en:wheat"],
			traces_tags: ["en:sesame"],
		}),
		preferences: { dietaryRestrictions: ["Gluten-free"] },
		expected: { status: "conflict", warningLabels: ["Gluten-free"] },
		features: ["dietary-conflict", "gluten"],
	}),
	createOpenFoodFactsCase({
		id: "missing-fields",
		name: "Missing disclosures remain incomplete rather than safe",
		product: syntheticProduct("Synthetic incomplete snack", {
			ingredients_text: "Corn, salt",
		}),
		preferences: { allergens: ["Peanut"] },
		expected: { status: "incomplete", warningLabels: [] },
		features: ["missing-fields", "incomplete"],
	}),
	createOpenFoodFactsCase({
		id: "formulation-before",
		name: "Earlier formulation remains conflict-free for the selected preference",
		product: syntheticProduct("Synthetic reformulated bar", {
			ingredients_text: "Oats, cocoa",
			allergens_tags: ["en:soy"],
			traces_tags: ["en:sesame"],
			rev: 1,
		}),
		preferences: { allergens: ["Peanut"] },
		expected: { status: "checked", warningLabels: [] },
		features: ["formulation-change", "negative-control"],
	}),
	createOpenFoodFactsCase({
		id: "formulation-after",
		name: "Later formulation detects newly declared peanut",
		product: syntheticProduct("Synthetic reformulated bar", {
			ingredients_text: "Oats, cocoa. Contains: peanuts.",
			allergens_tags: ["en:peanuts"],
			traces_tags: ["en:sesame"],
			rev: 2,
		}),
		preferences: { allergens: ["Peanut"] },
		expected: {
			status: "conflict",
			warningLabels: ["Peanut"],
			contains: ["Peanuts"],
		},
		features: ["formulation-change", "new-conflict"],
	}),
	{
		id: "private-custom",
		name: "Private custom foods use entered ingredient evidence without sharing",
		kind: "private-custom",
		food: {
			name: "Private synthetic snack",
			servingWeightGrams: 100,
			ingredients: "Peanuts, cocoa",
			ingredientList: ["Peanuts", "Cocoa"],
			nutrients: [],
			customFood: true,
		},
		preferences: { allergens: ["Peanut"] },
		expected: { status: "conflict", warningLabels: ["Peanut"] },
		stages: ["ingredient-extraction", "policy-evaluation", "user-message"],
		features: ["private-custom", "not-shared"],
	},
	{
		id: "generic-identity",
		name: "Authoritative generic identity supplies intrinsic allergen evidence",
		kind: "generic",
		food: {
			fdcId: 999001,
			description: "Crustaceans, Shrimp, Raw",
			dataType: "Foundation",
			foodIdentityType: "generic",
			sourceKey: "usda",
			foodNutrients: [],
		},
		preferences: { allergens: ["Shellfish"] },
		expected: {
			status: "conflict",
			warningLabels: ["Shellfish"],
			contains: ["Shellfish"],
		},
		stages: ["ingredient-extraction", "policy-evaluation", "user-message"],
		features: ["generic-identity", "intrinsic-allergen"],
	},
];

export const FOOD_SAFETY_END_TO_END_REQUIRED_FEATURES = [
	"explicit-contains",
	"may-contain",
	"shared-equipment",
	"shared-facility",
	"nested-ingredient",
	"french",
	"spanish",
	"unsupported-language",
	"negative-control",
	"compound-term",
	"dietary-conflict",
	"missing-fields",
	"formulation-change",
	"private-custom",
	"generic-identity",
] as const;
