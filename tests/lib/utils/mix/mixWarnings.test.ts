import { describe, expect, it } from "vitest";
import {
	getFoodPreferenceWarningsForMix,
	getNutrientGoalWarnings,
} from "$lib/utils/mix/warnings/mixWarnings";
import type { MixGoalType, MixNutrientGoal } from "$lib/utils/mix/goals/types";
import type { FoodItem } from "$lib/utils/food/types";
import { withOverageDetails } from "$lib/utils/mix/ui/mixUi";

const goal = (
	nutrientId: number,
	goalType: MixGoalType,
	targetAmount: number,
): MixNutrientGoal => ({
	nutrientId,
	goalType,
	targetAmount,
	upperAmount: null,
	toleranceRatio: 0,
	importanceWeight: 1,
	sortOrder: 1,
});

describe("Mix warnings", () => {
	it("reports nutrients over goal", () => {
		const warnings = getNutrientGoalWarnings([
			{
				id: 2000,
				label: "Sugar",
				unit: "g",
				total: 33,
				goal: goal(2000, "maximum", 25),
			},
		]);

		expect(warnings).toEqual([
			expect.objectContaining({
				id: "over-2000",
				severity: "danger",
				message: "Sugar exceeds goal by 8 g.",
			}),
		]);
	});

	it("adds contributor evidence without replacing goal evidence", () => {
		const [warning] = getNutrientGoalWarnings([
			{
				id: 2000,
				label: "Sugar",
				unit: "g",
				total: 33,
				goal: goal(2000, "maximum", 25),
			},
		]);
		const enrichedWarning = withOverageDetails(warning, [
			{
				nutrientId: 2000,
				label: "Sugar",
				unit: "g",
				total: 33,
				goal: 25,
				overage: 8,
				contributors: [{ label: "Banana, Raw", amount: 12, grams: 120 }],
			},
		]);

		expect(enrichedWarning.details).toEqual([
			{ label: "Current Mix", value: "33 g" },
			{ label: "Goal", value: "≤25 g" },
			{ label: "Overage", value: "8 g" },
			{ label: "From Banana, Raw", value: "12 g from 120 g" },
		]);
	});

	it("reports nutrients under target", () => {
		const warnings = getNutrientGoalWarnings([
			{
				id: 1003,
				label: "Protein",
				unit: "g",
				total: 13,
				goal: goal(1003, "minimum", 25),
			},
		]);

		expect(warnings).toEqual([
			expect.objectContaining({
				id: "under-1003",
				severity: "warning",
				message: "Protein is under target by 12 g.",
				detailSummary: "13 g / ≥25 g",
				details: [
					{ label: "Current Mix", value: "13 g" },
					{ label: "Goal", value: "≥25 g" },
					{ label: "Shortfall", value: "12 g" },
				],
			}),
		]);
	});

	it("suppresses under-target warnings before ingredients are selected", () => {
		const warnings = getNutrientGoalWarnings(
			[
				{
					id: 1003,
					label: "Protein",
					unit: "g",
					total: 0,
					goal: goal(1003, "minimum", 25),
				},
			],
			{ includeUnderTargets: false },
		);

		expect(warnings).toEqual([]);
	});

	it("keeps each preference conflict and its evidence independently explainable", () => {
		const food: FoodItem = {
			fdcId: 72,
			description: "Test meal",
			foodNutrients: [],
			preferenceWarnings: [
				{
					id: "allergen-peanut",
					level: "warning",
					category: "allergen",
					label: "Peanut",
					code: "FOOD_ALLERGEN_CONTAINS",
					params: { factLabel: "Peanut" },
					evidence: {
						factType: "contains",
						sourceType: "label_allergen_field",
						sourceText: "Peanut",
						confidence: "confirmed",
						policyVersion: 3,
						ingredientPath: [],
						percentageLabel: null,
					},
				},
				{
					id: "restriction-vegan",
					level: "warning",
					category: "restriction",
					label: "Vegan",
					code: "FOOD_RESTRICTION_CONFLICT",
					params: {
						restrictionLabel: "Vegan",
						factLabel: "Milk",
					},
				},
			],
		};

		const warnings = getFoodPreferenceWarningsForMix([food]);

		expect(warnings).toHaveLength(2);
		expect(warnings.map(({ id }) => id)).toEqual([
			"food-preference-72-allergen-peanut",
			"food-preference-72-restriction-vegan",
		]);
		expect(warnings[0]).toMatchObject({
			title: "Test meal",
			detailSummary: "Selected allergen: Peanut",
			details: expect.arrayContaining([
				{
					label: "Evidence",
					value: "The package’s Contains information lists “Peanut”.",
				},
			]),
		});
	});
});
