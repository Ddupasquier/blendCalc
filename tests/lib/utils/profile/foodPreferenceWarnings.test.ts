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
};

const makeFood = (overrides: Partial<FdcFood>): FdcFood => ({
	fdcId: 1,
	description: "Whole milk",
	foodCategory: "Dairy",
	foodNutrients: [],
	...overrides,
});

describe("food preference warnings", () => {
	it("treats plain description matches as potential instead of confirmed", () => {
		const warnings = getFoodPreferenceWarnings(
			makeFood({ description: "Whole milk" }),
			{ ...baseProfile, allergens: ["Dairy"] },
		);

		expect(warnings).toEqual([
			expect.objectContaining({
				category: "allergen",
				label: "Dairy",
				level: "potential",
			}),
		]);
	});

	it("warns from controlled ingredient text terms", () => {
		const warnings = getFoodPreferenceWarnings(
			makeFood({
				description: "Protein shake",
				ingredients: "Water, whey protein isolate, cocoa",
			}),
			{ ...baseProfile, allergens: ["Dairy"] },
		);

		expect(warnings).toEqual([
			expect.objectContaining({
				category: "allergen",
				label: "Dairy",
				level: "warning",
			}),
		]);
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

	it("still flags plant milk for the actual plant allergen", () => {
		const warnings = getFoodPreferenceWarnings(
			makeFood({
				description: "Unsweetened almond milk",
				ingredients: "Almond milk, calcium carbonate, sea salt",
			}),
			{ ...baseProfile, allergens: ["Tree Nut"] },
		);

		expect(warnings).toEqual([
			expect.objectContaining({
				category: "allergen",
				label: "Tree Nut",
				level: "warning",
			}),
		]);
	});

	it("warns when dietary restrictions conflict with ingredients", () => {
		const warnings = getFoodPreferenceWarnings(
			makeFood({
				description: "Evaporated milk",
				ingredients: "Milk, vitamin D3",
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

		expect(warnings[0]?.reason).toContain("product metadata");
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
			}),
		]);
	});
});
