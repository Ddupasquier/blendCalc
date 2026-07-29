import { describe, expect, it } from "vitest";
import { getFoodPreferenceWarningMessage } from "$lib/utils/profile/foodPreferenceWarnings";
import type { FoodCompatibilityFact } from "$lib/utils/food/quality/compatibility";
import type { FoodPreferenceProfile } from "$lib/utils/profile/foodPreferenceProfile";
import type { FdcFood } from "$lib/utils/food/types";
import { annotateFoodWithFoodSafety } from "$lib/server/food-safety/foodSafetyEvaluation.server";
import type {
	FoodCompatibilityMatchRule,
	FoodPreferenceConflictRule,
} from "$lib/server/food-safety/foodSafetyPolicy.server";

type TestPreferenceProfile = FoodPreferenceProfile & {
	warningRules?: FoodPreferenceConflictRule[];
	matchRules?: FoodCompatibilityMatchRule[];
};

const baseProfile: TestPreferenceProfile = {
	unitSystem: null,
	allergens: [],
	dietaryRestrictions: [],
	prioritizedNutrientIds: [],
	defaultSmoothieServingGrams: null,
	sensitiveAcknowledgedAt: null,
	warningRules: [
		{
			preferenceSlug: "dairy",
			preferenceLabel: "Dairy",
			factSlug: "milk",
			factLabel: "Milk",
			level: "warning",
			warningCode: "FOOD_RESTRICTION_CONFLICT",
			priority: 10,
		},
		{
			preferenceSlug: "vegan",
			preferenceLabel: "Vegan",
			factSlug: "milk",
			factLabel: "Milk",
			level: "warning",
			warningCode: "FOOD_RESTRICTION_CONFLICT",
			priority: 10,
		},
	],
	matchRules: [],
};

const getFoodPreferenceWarnings = (
	food: FdcFood,
	profile: TestPreferenceProfile,
) => annotateFoodWithFoodSafety(food, {
	profile,
	policy: {
		version: 1,
		reviewedAt: "2026-07-29T00:00:00.000Z",
		preferenceConflictRules: profile.warningRules ?? [],
		compatibilityMatchRules: profile.matchRules ?? [],
		regionalProfiles: [],
	},
}).preferenceWarnings ?? [];

const makeFood = (overrides: Partial<FdcFood>): FdcFood => ({
	fdcId: 1,
	description: "Whole milk",
	foodCategory: "Dairy",
	foodNutrients: [],
	...overrides,
});

describe("food preference warnings", () => {
	it("does not infer allergens from product descriptions", () => {
		const warnings = getFoodPreferenceWarnings(
			makeFood({ description: "Whole milk" }),
			{ ...baseProfile, allergens: ["Dairy"] },
		);

		expect(warnings).toEqual([]);
	});

	it("does not infer allergens from unstructured ingredient text", () => {
		const warnings = getFoodPreferenceWarnings(
			makeFood({
				description: "Protein shake",
				ingredients: "Water, whey protein isolate, cocoa",
			}),
			{ ...baseProfile, allergens: ["Dairy"] },
		);

		expect(warnings).toEqual([]);
	});

	it("does not flag plant milk as dairy or milk", () => {
		const warnings = getFoodPreferenceWarnings(
			makeFood({
				description: "Unsweetened almond milk",
				foodCategory: "Plant-based beverages",
				ingredients: "Almond milk, calcium carbonate, sea salt",
			}),
			{
				...baseProfile,
				allergens: ["Milk"],
				dietaryRestrictions: ["Dairy-free", "Vegan"],
			},
		);

		expect(warnings).toEqual([]);
	});

	it("does not use hardcoded aliases for unstructured ingredient text", () => {
		const warnings = getFoodPreferenceWarnings(
			makeFood({
				description: "Unsweetened almond milk",
				ingredients: "Almond milk, calcium carbonate, sea salt",
			}),
			{ ...baseProfile, allergens: ["Tree Nut"] },
		);

		expect(warnings).toEqual([]);
	});

	it("warns when dietary restrictions conflict with ingredients", () => {
		const warnings = getFoodPreferenceWarnings(
			makeFood({
				description: "Evaporated milk",
				ingredients: "Milk, vitamin D3",
				allergens: ["Milk"],
			}),
			{ ...baseProfile, dietaryRestrictions: ["Vegan"] },
		);

		expect(warnings).toEqual([
			expect.objectContaining({
				category: "restriction",
				label: "Vegan",
				level: "warning",
			}),
		]);
		expect(getFoodPreferenceWarningMessage(warnings[0]))
			.toBe(
				"This may not be vegan because the label lists milk as an allergen.",
			);
	});

	it("prefers DB-backed compatibility facts when available", () => {
		const warnings = getFoodPreferenceWarnings(
			makeFood({
				description: "Verified milk drink",
				compatibilitySummary: {
					version: 1,
					policyVersion: 1,
					generatedAt: new Date().toISOString(),
					allFacts: [
						{
							slug: "dairy",
							label: "Dairy",
							category: "allergen",
							factType: "contains",
							sourceType: "label_allergen_field",
							sourceText: "milk",
							confidence: "confirmed",
						},
					],
					contains: [],
					mayContain: [],
					dietaryClaims: [],
					ingredientSignals: [],
				},
			}),
			{ ...baseProfile, allergens: ["Dairy"] },
		);

		expect(warnings[0] && getFoodPreferenceWarningMessage(warnings[0]))
			.toBe("The label lists dairy as an allergen.");
	});

	it("matches exact allergen metadata without substring parsing", () => {
		const warnings = getFoodPreferenceWarnings(
			makeFood({
				description: "Nut bar",
				allergens: ["Peanut"],
			}),
			{ ...baseProfile, allergens: ["Peanut"] },
		);

		expect(warnings).toEqual([
			expect.objectContaining({
				category: "allergen",
				label: "Peanut",
				level: "warning",
				code: "FOOD_ALLERGEN_CONTAINS",
			}),
		]);
		expect(getFoodPreferenceWarningMessage(warnings[0]))
			.toBe("The label lists peanut as an allergen.");
	});

	it("uses DB-provided ingredient rules for dietary conflicts", () => {
		const warnings = getFoodPreferenceWarnings(
			makeFood({
				description: "Gochujang",
				ingredients: "Rice, soybean paste, wheat extract, salt",
			}),
			{
				...baseProfile,
				dietaryRestrictions: ["Gluten-free"],
				warningRules: [{
					preferenceSlug: "gluten-free",
					preferenceLabel: "Gluten-free",
					factSlug: "wheat",
					factLabel: "Wheat",
					level: "warning",
					warningCode: "FOOD_RESTRICTION_CONFLICT",
					priority: 10,
				}],
				matchRules: [{
					sourceKey: null,
					fieldName: "ingredients",
					matchPattern: "\\bwheat\\b",
					excludePattern: null,
					tagSlug: "wheat",
					tagLabel: "Wheat",
					tagCategory: "allergen",
					factType: "ingredient_present",
					sourceType: "label_ingredient_field",
					confidence: "confirmed",
					priority: 10,
				}],
			},
		);

		expect(warnings).toEqual([
			expect.objectContaining({
				category: "restriction",
				label: "Gluten-free",
				level: "warning",
				code: "FOOD_RESTRICTION_CONFLICT",
			}),
		]);
		expect(getFoodPreferenceWarningMessage(warnings[0]))
			.toBe(
				"This may not be gluten-free because wheat appears in the ingredient list.",
			);
	});

	it("ignores stale title-based compatibility rules", () => {
		const staleTitleRule = {
			sourceKey: "usda",
			fieldName: "description",
			matchPattern: "\\b(?:shellfish|shrimp|crustaceans?)\\b",
			excludePattern: null,
			tagSlug: "shellfish",
			tagLabel: "Shellfish",
			tagCategory: "allergen",
			factType: "ingredient_present",
			sourceType: "source_food_identity",
			confidence: "confirmed",
			priority: 10,
		} as unknown as FoodCompatibilityMatchRule;
		const warnings = getFoodPreferenceWarnings(
			makeFood({
				description: "Crustaceans, shrimp, raw",
				sourceKey: "usda",
			}),
			{
				...baseProfile,
				allergens: ["Shellfish"],
				warningRules: [{
					preferenceSlug: "shellfish",
					preferenceLabel: "Shellfish",
					factSlug: "shellfish",
					factLabel: "Shellfish",
					level: "warning",
					warningCode: "FOOD_RESTRICTION_CONFLICT",
					priority: 10,
				}],
				matchRules: [staleTitleRule],
			},
		);

		expect(warnings).toEqual([]);
	});

	it("uses authoritative generic food identity for intrinsic allergens", () => {
		const warnings = getFoodPreferenceWarnings(
			makeFood({
				description: "Crustaceans, shrimp, raw",
				foodIdentityType: "generic",
				dataType: "Foundation",
				sourceKey: "usda",
			}),
			{
				...baseProfile,
				allergens: ["Shellfish"],
				matchRules: [{
					sourceKey: null,
					fieldName: "generic_food_identity",
					matchPattern: "\\b(?:shrimp|crustaceans?)\\b",
					excludePattern: null,
					tagSlug: "shellfish",
					tagLabel: "Shellfish",
					tagCategory: "allergen",
					factType: "contains",
					sourceType: "food_identity_taxonomy",
					confidence: "confirmed",
					priority: 10,
				}],
			},
		);

		expect(warnings).toEqual([
			expect.objectContaining({
				category: "allergen",
				label: "Shellfish",
				level: "warning",
				code: "FOOD_INTRINSIC_ALLERGEN",
			}),
		]);
		expect(getFoodPreferenceWarningMessage(warnings[0]))
			.toBe("This ingredient is shellfish.");
	});

	it("does not use a packaged product name as intrinsic allergen evidence", () => {
		const genericRule: FoodCompatibilityMatchRule = {
			sourceKey: null,
			fieldName: "generic_food_identity",
			matchPattern: "\\bshrimp\\b",
			excludePattern: null,
			tagSlug: "shellfish",
			tagLabel: "Shellfish",
			tagCategory: "allergen",
			factType: "contains",
			sourceType: "food_identity_taxonomy",
			confidence: "confirmed",
			priority: 10,
		};
		const warnings = getFoodPreferenceWarnings(
			makeFood({
				description: "Shrimp Flavored Crackers",
				foodIdentityType: "packaged",
				dataType: "Branded",
				barcode: "00012345678905",
			}),
			{
				...baseProfile,
				allergens: ["Shellfish"],
				matchRules: [genericRule],
			},
		);

		expect(warnings).toEqual([]);
	});

	it("ignores stored compatibility facts derived from product identity", () => {
		const warnings = getFoodPreferenceWarnings(
			makeFood({
				description: "Bread stuffing",
				compatibilitySummary: {
					version: 1,
					policyVersion: 1,
					generatedAt: new Date().toISOString(),
					allFacts: [{
						slug: "wheat",
						label: "Wheat",
						category: "allergen",
						factType: "ingredient_present",
						sourceType: "source_food_identity",
						sourceText: "Bread",
						confidence: "inferred",
					} as unknown as FoodCompatibilityFact],
					contains: [],
					mayContain: [],
					dietaryClaims: [],
					ingredientSignals: [],
				},
			}),
			{
				...baseProfile,
				dietaryRestrictions: ["Gluten-free"],
				warningRules: [{
					preferenceSlug: "gluten-free",
					preferenceLabel: "Gluten-free",
					factSlug: "wheat",
					factLabel: "Wheat",
					level: "warning",
					warningCode: "FOOD_RESTRICTION_CONFLICT",
					priority: 10,
				}],
			},
		);

		expect(warnings).toEqual([]);
	});

	it("uses explicit trace metadata for may-contain warnings", () => {
		const warnings = getFoodPreferenceWarnings(
			makeFood({
				description: "Chocolate snack",
				traces: ["Tree nuts"],
			}),
			{ ...baseProfile, allergens: ["Tree nuts"] },
		);

		expect(warnings).toEqual([
			expect.objectContaining({
				category: "allergen",
				label: "Tree nuts",
				level: "potential",
				code: "FOOD_ALLERGEN_MAY_CONTAIN",
			}),
		]);
		expect(getFoodPreferenceWarningMessage(warnings[0]))
			.toBe("The label says this product may contain tree nuts.");
	});

	it("does not infer gluten conflicts from bread or ramen titles", () => {
		const profile: TestPreferenceProfile = {
			...baseProfile,
			dietaryRestrictions: ["Gluten-free"],
			warningRules: [{
				preferenceSlug: "gluten-free",
				preferenceLabel: "Gluten-free",
				factSlug: "wheat",
				factLabel: "Wheat",
				level: "warning",
				warningCode: "FOOD_RESTRICTION_CONFLICT",
				priority: 10,
			}],
		};

		expect(getFoodPreferenceWarnings(
			makeFood({ description: "Bread stuffing", sourceKey: "usda" }),
			profile,
		)).toEqual([]);
		expect(getFoodPreferenceWarnings(
			makeFood({ description: "Soup, ramen noodles", sourceKey: "usda" }),
			profile,
		)).toEqual([]);
	});

	it("uses ingredient evidence even when the title says gluten-free", () => {
		const warnings = getFoodPreferenceWarnings(
			makeFood({
				description: "Bread, gluten-free",
				ingredients: "Rice flour, wheat starch, salt",
			}),
			{
				...baseProfile,
				dietaryRestrictions: ["Gluten-free"],
				warningRules: [{
					preferenceSlug: "gluten-free",
					preferenceLabel: "Gluten-free",
					factSlug: "wheat",
					factLabel: "Wheat",
					level: "warning",
					warningCode: "FOOD_RESTRICTION_CONFLICT",
					priority: 10,
				}],
				matchRules: [{
					sourceKey: null,
					fieldName: "ingredients",
					matchPattern: "\\bwheat\\b",
					excludePattern: null,
					tagSlug: "wheat",
					tagLabel: "Wheat",
					tagCategory: "allergen",
					factType: "ingredient_present",
					sourceType: "label_ingredient_field",
					confidence: "confirmed",
					priority: 10,
				}],
			},
		);

		expect(warnings).toEqual([
			expect.objectContaining({
				category: "restriction",
				label: "Gluten-free",
				level: "warning",
				code: "FOOD_RESTRICTION_CONFLICT",
			}),
		]);
		expect(getFoodPreferenceWarningMessage(warnings[0]))
			.toBe(
				"This may not be gluten-free because wheat appears in the ingredient list.",
			);
	});

	it("uses DB-provided generic food taxonomy rules for vegan land-meat conflicts", () => {
		const warnings = getFoodPreferenceWarnings(
			makeFood({
				description: "Beef, ground, raw",
				foodIdentityType: "generic",
				dataType: "Foundation",
				sourceKey: "usda",
			}),
			{
				...baseProfile,
				dietaryRestrictions: ["Vegan"],
				warningRules: [{
					preferenceSlug: "vegan",
					preferenceLabel: "Vegan",
					factSlug: "meat",
					factLabel: "Meat",
					level: "warning",
					warningCode: "FOOD_RESTRICTION_CONFLICT",
					priority: 10,
				}],
				matchRules: [{
					sourceKey: null,
					fieldName: "generic_food_identity",
					matchPattern: "\\b(?:beef|meat)\\b",
					excludePattern: null,
					tagSlug: "meat",
					tagLabel: "Meat",
					tagCategory: "avoidance",
					factType: "dietary_conflict",
					sourceType: "food_identity_taxonomy",
					confidence: "confirmed",
					priority: 10,
				}],
			},
		);

		expect(warnings).toEqual([
			expect.objectContaining({
				category: "restriction",
				label: "Vegan",
				level: "warning",
			}),
		]);
		expect(getFoodPreferenceWarningMessage(warnings[0]))
			.toBe("This may not be vegan because this ingredient is meat.");
	});

	it("uses DB-provided ingredient rules for packaged meat without reading its title", () => {
		const profile: TestPreferenceProfile = {
			...baseProfile,
			dietaryRestrictions: ["Vegetarian"],
			warningRules: [{
				preferenceSlug: "vegetarian",
				preferenceLabel: "Vegetarian",
				factSlug: "meat",
				factLabel: "Meat",
				level: "warning",
				warningCode: "FOOD_RESTRICTION_CONFLICT",
				priority: 10,
			}],
			matchRules: [{
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
			}],
		};

		expect(getFoodPreferenceWarnings(
			makeFood({
				description: "Savory snack",
				foodIdentityType: "packaged",
				ingredients: "Potatoes, beef, salt",
			}),
			profile,
		)).toHaveLength(1);
		expect(getFoodPreferenceWarnings(
			makeFood({
				description: "Beef-flavored snack",
				foodIdentityType: "packaged",
				ingredients: "Potatoes, salt",
			}),
			profile,
		)).toEqual([]);
	});

	it("does not let a dietary claim hide conflicting ingredient evidence", () => {
		const warnings = getFoodPreferenceWarnings(
			makeFood({
				description: "Incorrectly labeled entrée",
				foodIdentityType: "packaged",
				dietaryTags: ["Vegan"],
				ingredients: "Rice, chicken, salt",
			}),
			{
				...baseProfile,
				dietaryRestrictions: ["Vegan"],
				warningRules: [{
					preferenceSlug: "vegan",
					preferenceLabel: "Vegan",
					factSlug: "meat",
					factLabel: "Meat",
					level: "warning",
					warningCode: "FOOD_RESTRICTION_CONFLICT",
					priority: 10,
				}],
				matchRules: [{
					sourceKey: null,
					fieldName: "ingredients",
					matchPattern: "\\bchicken\\b",
					excludePattern: null,
					tagSlug: "meat",
					tagLabel: "Meat",
					tagCategory: "avoidance",
					factType: "dietary_conflict",
					sourceType: "label_ingredient_field",
					confidence: "confirmed",
					priority: 10,
				}],
			},
		);

		expect(warnings).toHaveLength(1);
	});

	it("canonicalizes provider allergen aliases through DB-provided rules", () => {
		const warnings = getFoodPreferenceWarnings(
			makeFood({
				description: "Prepared food",
				allergens: ["en:crustaceans"],
			}),
			{
				...baseProfile,
				allergens: ["Shellfish"],
				matchRules: [{
					sourceKey: null,
					fieldName: "allergens",
					matchPattern: "\\bcrustaceans?\\b",
					excludePattern: null,
					tagSlug: "shellfish",
					tagLabel: "Shellfish",
					tagCategory: "allergen",
					factType: "contains",
					sourceType: "label_allergen_field",
					confidence: "confirmed",
					priority: 10,
				}],
			},
		);

		expect(warnings).toEqual([
			expect.objectContaining({
				category: "allergen",
				label: "Shellfish",
				level: "warning",
			}),
		]);
	});

	it("uses source dietary analysis as potential conflict evidence", () => {
		const warnings = getFoodPreferenceWarnings(
			makeFood({
				description: "Prepared food",
				ingredientAnalysis: {
					ingredientTags: [],
					analysisTags: ["en:non-vegan"],
					derivedTraceTags: [],
				},
			}),
			{
				...baseProfile,
				dietaryRestrictions: ["Vegan"],
				warningRules: [{
					preferenceSlug: "vegan",
					preferenceLabel: "Vegan",
					factSlug: "non-vegan",
					factLabel: "Non-vegan source analysis",
					level: "warning",
					warningCode: "FOOD_RESTRICTION_CONFLICT",
					priority: 1,
				}],
				matchRules: [{
					sourceKey: null,
					fieldName: "ingredient_analysis",
					matchPattern: "non-vegan",
					excludePattern: null,
					tagSlug: "non-vegan",
					tagLabel: "Non-vegan source analysis",
					tagCategory: "avoidance",
					factType: "dietary_conflict",
					sourceType: "source_dietary_analysis",
					confidence: "inferred",
					priority: 10,
				}],
			},
		);

		expect(warnings).toEqual([
			expect.objectContaining({
				category: "restriction",
				label: "Vegan",
				level: "potential",
			}),
		]);
		expect(getFoodPreferenceWarningMessage(warnings[0]))
			.toBe(
				"The source’s ingredient analysis indicates this may not be vegan.",
			);
	});

	it("returns DB-reviewed dietary claims and conflict evidence for nutrition details", () => {
		const food = annotateFoodWithFoodSafety(
			makeFood({
				description: "Prepared entrée",
				dietaryTags: ["en:vegan", "en:organic"],
				ingredients: "Rice, chicken, salt",
			}),
			{
				profile: null,
				policy: {
					version: 1,
					reviewedAt: "2026-07-29T00:00:00.000Z",
					preferenceConflictRules: [
						{
							preferenceSlug: "vegan",
							preferenceLabel: "Vegan",
							preferenceCategory: "dietary",
							factSlug: "meat",
							factLabel: "Meat",
							level: "warning",
							warningCode: "FOOD_RESTRICTION_CONFLICT",
							priority: 10,
						},
					],
					compatibilityMatchRules: [{
						sourceKey: null,
						fieldName: "ingredients",
						matchPattern: "\\bchicken\\b",
						excludePattern: null,
						tagSlug: "meat",
						tagLabel: "Meat",
						tagCategory: "avoidance",
						factType: "dietary_conflict",
						sourceType: "label_ingredient_field",
						confidence: "confirmed",
						priority: 10,
					}],
					regionalProfiles: [],
				},
			},
		);

		expect(food.compatibilitySummary?.dietaryClaims)
			.toEqual([expect.objectContaining({ slug: "vegan", label: "Vegan" })]);
		expect(food.compatibilitySummary?.dietaryClaims)
			.not.toEqual(expect.arrayContaining([
				expect.objectContaining({ label: "Organic" }),
			]));
		expect(food.compatibilitySummary?.allFacts)
			.toEqual(expect.arrayContaining([
				expect.objectContaining({
					slug: "meat",
					factType: "dietary_conflict",
				}),
			]));
	});
});
