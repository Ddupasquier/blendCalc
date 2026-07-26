import { describe, expect, it } from "vitest";
import { getFoodPreferenceWarnings } from "$lib/utils/profile/foodPreferenceWarnings";
import type { FoodPreferenceProfile } from "$lib/utils/profile/foodPreferenceProfile";
import type { FdcFood } from "$lib/utils/food/types";

const baseProfile: FoodPreferenceProfile = {
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
		},
		{
			preferenceSlug: "vegan",
			preferenceLabel: "Vegan",
			factSlug: "milk",
			factLabel: "Milk",
			level: "warning",
		},
	],
	matchRules: [],
};

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
	});

	it("prefers DB-backed compatibility facts when available", () => {
		const warnings = getFoodPreferenceWarnings(
			makeFood({
				description: "Verified milk drink",
				compatibilitySummary: {
					version: 1,
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

		expect(warnings[0]?.reason)
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
				reason: "The label lists peanut as an allergen.",
			}),
		]);
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
				reason:
					"This may not be gluten-free because wheat appears in the ingredient list.",
			}),
		]);
	});

	it("uses DB-provided source identity rules for shellfish conflicts", () => {
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
				}],
				matchRules: [{
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
				}],
			},
		);

		expect(warnings).toEqual([
			expect.objectContaining({
				category: "allergen",
				label: "Shellfish",
				level: "warning",
				reason: "This food is identified as shellfish.",
			}),
		]);
	});

	it("uses inferred identity rules for likely gluten conflicts in search", () => {
		const profile: FoodPreferenceProfile = {
			...baseProfile,
			dietaryRestrictions: ["Gluten-free"],
			warningRules: [{
				preferenceSlug: "gluten-free",
				preferenceLabel: "Gluten-free",
				factSlug: "wheat",
				factLabel: "Wheat",
				level: "warning",
			}],
			matchRules: [{
				sourceKey: null,
				fieldName: "description",
				matchPattern: "\\b(?:bread|ramen|noodles?)\\b",
				excludePattern: "\\b(?:gluten[\\s-]*free|rice noodles?)\\b",
				tagSlug: "wheat",
				tagLabel: "Wheat",
				tagCategory: "allergen",
				factType: "ingredient_present",
				sourceType: "source_food_identity",
				confidence: "inferred",
				priority: 10,
			}],
		};

		expect(
			getFoodPreferenceWarnings(
				makeFood({ description: "Bread stuffing", sourceKey: "usda" }),
				profile,
			),
		).toEqual([
			expect.objectContaining({
				category: "restriction",
				label: "Gluten-free",
				level: "potential",
				reason:
					"This may not be gluten-free because the food name suggests wheat may be present.",
			}),
		]);
		expect(
			getFoodPreferenceWarnings(
				makeFood({ description: "Soup, ramen noodles", sourceKey: "usda" }),
				profile,
			),
		).toHaveLength(1);
	});

	it("honors rule exclusions for explicitly gluten-free identities", () => {
		const warnings = getFoodPreferenceWarnings(
			makeFood({
				description: "Bread, gluten-free",
				sourceKey: "usda",
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
				}],
				matchRules: [{
					sourceKey: null,
					fieldName: "description",
					matchPattern: "\\bbread\\b",
					excludePattern: "\\bgluten[\\s-]*free\\b",
					tagSlug: "wheat",
					tagLabel: "Wheat",
					tagCategory: "allergen",
					factType: "ingredient_present",
					sourceType: "source_food_identity",
					confidence: "inferred",
					priority: 10,
				}],
			},
		);

		expect(warnings).toEqual([]);
	});
});
