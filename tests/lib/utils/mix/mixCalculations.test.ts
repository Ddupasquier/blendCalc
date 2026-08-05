import { afterEach, describe, expect, it } from "vitest";
import {
	getChartValues,
	getGoalValues,
	getNutrientAdjustmentSuggestions,
	getNutrientChartMetrics,
	getNutrientContributionBreakdowns,
	getNutrientContributors,
	getNutrientProgress,
	getNutrientTotal,
} from "$lib/utils/mix/calculations";
import { configureAppReferenceCatalog } from "$lib/utils/food/reference/appReferenceCatalog";
import { resolveFdcNutrient } from "$lib/utils/food/nutrients/fdcNutrients";
import { NUTRIENT_IDS, type FdcFood } from "$lib/utils/food/types";
import { appReferenceCatalogFixture } from "../../../fixtures/referenceData";

const sunflowerOil = {
	fdcId: 1,
	description: "Sunflower oil",
	sourceKey: "usda",
	foodNutrients: [
		{
			nutrientId: 1085,
			nutrientName: "Total fat (NLEA)",
			nutrientNumber: "298",
			unitName: "G",
			value: 93.2,
		},
	],
} satisfies FdcFood;

const milk = {
	fdcId: 2,
	description: "2% milk",
	foodNutrients: [
		{
			nutrientId: NUTRIENT_IDS.PROTEIN,
			nutrientName: "Protein",
			nutrientNumber: "203",
			unitName: "G",
			value: 3.33,
		},
	],
} satisfies FdcFood;

const exactGoal = (
  nutrientId: number,
  targetAmount: number,
  sortOrder = 1,
) => ({
  nutrientId,
  goalType: "exact" as const,
  targetAmount,
  upperAmount: null,
  toleranceRatio: 0.1,
  importanceWeight: 1,
  sortOrder,
});

describe("mix calculations", () => {
	afterEach(() => configureAppReferenceCatalog(appReferenceCatalogFixture));

	it("uses fallback nutrient mappings for totals", () => {
		expect(
			getNutrientTotal([sunflowerOil], NUTRIENT_IDS.FAT, {
				1: 50,
			}),
		).toBeCloseTo(46.6);
	});

	it("keeps the immutable per-100g basis when the default Mix amount changes", () => {
		configureAppReferenceCatalog({
			...appReferenceCatalogFixture,
			mixRuntime: {
				...appReferenceCatalogFixture.mixRuntime,
				defaultServingGrams: 50,
			},
		});

		expect(
			getNutrientTotal([sunflowerOil], NUTRIENT_IDS.FAT, {
				[sunflowerOil.fdcId]: 50,
			}),
		).toBeCloseTo(46.6);
	});

	it("keeps reported zero separate from a missing nutrient", () => {
		const zeroProteinFood = {
			fdcId: 10,
			description: "Zero protein food",
			foodNutrients: [
				{
					nutrientId: NUTRIENT_IDS.PROTEIN,
					nutrientName: "Protein",
					nutrientNumber: "203",
					unitName: "G",
					value: 0,
				},
			],
		} satisfies FdcFood;

    expect(
      resolveFdcNutrient(zeroProteinFood, NUTRIENT_IDS.PROTEIN),
    ).toMatchObject({
			value: 0,
			source: "exact",
		});
		expect(
      getNutrientTotal([zeroProteinFood], NUTRIENT_IDS.PROTEIN, {
        [zeroProteinFood.fdcId]: 100,
      }),
		).toBe(0);
	});

	it("uses zero for an ingredient nutrient that is not reported", () => {
    const total = getNutrientTotal([milk], NUTRIENT_IDS.FAT, {
      [milk.fdcId]: 100,
    });

		expect(total).toBe(0);
		expect(resolveFdcNutrient(milk, NUTRIENT_IDS.FAT)).toMatchObject({
			value: null,
			source: "missing",
		});
	});

	it("derives calories only when fat, carbs, and protein are all reported", () => {
		const completeMacros = {
			fdcId: 11,
			description: "Complete macros",
			foodNutrients: [
        {
          nutrientId: NUTRIENT_IDS.FAT,
          nutrientName: "Fat",
          nutrientNumber: "204",
          unitName: "G",
          value: 2,
        },
        {
          nutrientId: NUTRIENT_IDS.CARBS,
          nutrientName: "Carbohydrate",
          nutrientNumber: "205",
          unitName: "G",
          value: 3,
        },
        {
          nutrientId: NUTRIENT_IDS.PROTEIN,
          nutrientName: "Protein",
          nutrientNumber: "203",
          unitName: "G",
          value: 4,
        },
			],
		} satisfies FdcFood;
		const incompleteMacros = {
			...completeMacros,
			fdcId: 12,
			foodNutrients: completeMacros.foodNutrients.filter(
				(nutrient) => nutrient.nutrientId !== NUTRIENT_IDS.PROTEIN,
			),
		} satisfies FdcFood;

    expect(
      resolveFdcNutrient(completeMacros, NUTRIENT_IDS.CALORIES),
    ).toMatchObject({
			value: 46,
			source: "derived",
		});
    expect(
      resolveFdcNutrient(incompleteMacros, NUTRIENT_IDS.CALORIES),
    ).toMatchObject({
			value: null,
			source: "missing",
		});
	});

	it("sorts overage contributors by amount", () => {
		const contributors = getNutrientContributors(
			[sunflowerOil, milk],
			NUTRIENT_IDS.FAT,
			{ 1: 50, 2: 100 },
		);

		expect(contributors[0]).toMatchObject({
			label: "Sunflower oil",
			amount: 46.6,
			grams: 50,
		});
	});

	it("calculates top nutrient contribution percentages", () => {
		const banana = {
			fdcId: 3,
			description: "Banana",
			foodNutrients: [
				{
					nutrientId: NUTRIENT_IDS.CARBS,
					nutrientName: "Carbohydrate",
					nutrientNumber: "205",
					unitName: "G",
					value: 22.8,
				},
			],
		} satisfies FdcFood;
		const honey = {
			fdcId: 4,
			description: "Honey",
			foodNutrients: [
				{
					nutrientId: NUTRIENT_IDS.CARBS,
					nutrientName: "Carbohydrate",
					nutrientNumber: "205",
					unitName: "G",
					value: 82.4,
				},
			],
		} satisfies FdcFood;

		const breakdowns = getNutrientContributionBreakdowns(
			[
				{
					id: NUTRIENT_IDS.CARBS,
					label: "Total Carb.",
					unit: "g",
				},
			],
			[banana, honey],
			{ 3: 100, 4: 25 },
			1,
		);

		expect(breakdowns).toHaveLength(1);
		expect(breakdowns[0].contributors).toHaveLength(1);
		expect(breakdowns[0].contributors[0]).toMatchObject({
			label: "Banana",
			amount: 22.8,
		});
		expect(breakdowns[0].contributors[0].percentOfTotal).toBeCloseTo(52.53);
	});

	it("calculates progress and chart values from goals", () => {
		const nutrients = [
			{ id: NUTRIENT_IDS.FAT, label: "Total Fat", unit: "g" },
			{ id: NUTRIENT_IDS.PROTEIN, label: "Protein", unit: "g" },
		];
		const foods = [sunflowerOil, milk];
		const servingGrams = { 1: 50, 2: 100 };
		const goals = {
      [NUTRIENT_IDS.FAT]: exactGoal(NUTRIENT_IDS.FAT, 25),
      [NUTRIENT_IDS.PROTEIN]: exactGoal(NUTRIENT_IDS.PROTEIN, 10, 2),
		};

    const progress = getNutrientProgress(nutrients, foods, goals, servingGrams);
		const metrics = getNutrientChartMetrics(
			nutrients,
			foods,
			goals,
			servingGrams,
		);

		expect(progress[0]).toBeCloseTo(1.864);
		expect(progress[1]).toBeCloseTo(0.333);
		expect(Math.max(...getGoalValues(metrics))).toBe(1);
		expect(getChartValues(metrics)[0]).toBeGreaterThan(
			getChartValues(metrics)[1],
		);
	});

	it("only adjusts foods already selected in the Mix", () => {
		const greekYogurt = {
			fdcId: 5,
			description: "Greek yogurt",
			foodNutrients: [
				{
					nutrientId: NUTRIENT_IDS.PROTEIN,
					nutrientName: "Protein",
					nutrientNumber: "203",
					unitName: "G",
					value: 10,
				},
			],
		} satisfies FdcFood;
		const suggestions = getNutrientAdjustmentSuggestions({
			nutrients: [{ id: NUTRIENT_IDS.PROTEIN, label: "Protein", unit: "g" }],
			selectedFoods: [milk],
      nutrientGoals: {
        [NUTRIENT_IDS.PROTEIN]: exactGoal(NUTRIENT_IDS.PROTEIN, 25),
      },
			servingGrams: { [milk.fdcId]: 100 },
		});

		expect(suggestions).toHaveLength(1);
		expect(suggestions[0]).toMatchObject({
			food: milk,
			direction: "increase",
			currentServingGrams: 100,
			nextServingGrams: 200,
			incrementSource: "configured-default",
		});
    expect(
      suggestions.some(({ food }) => food.fdcId === greekYogurt.fdcId),
    ).toBe(false);
	});

	it("uses a reported serving as the practical adjustment step", () => {
		const portionedMilk = {
			...milk,
      foodServings: [
        {
				label: "1 fl oz",
				gramWeight: 30,
				isPrimary: true,
				origin: "package-label",
				gramWeightMethod: "source-reported",
        },
      ],
		} satisfies FdcFood;
		const suggestions = getNutrientAdjustmentSuggestions({
			nutrients: [{ id: NUTRIENT_IDS.PROTEIN, label: "Protein", unit: "g" }],
			selectedFoods: [portionedMilk],
      nutrientGoals: {
        [NUTRIENT_IDS.PROTEIN]: exactGoal(NUTRIENT_IDS.PROTEIN, 6),
      },
			servingGrams: { [portionedMilk.fdcId]: 100 },
		});

		expect(suggestions[0]).toMatchObject({
			direction: "increase",
			changeGrams: 30,
			nextServingGrams: 130,
			incrementLabel: "1 fl oz",
			incrementSource: "source-serving",
		});
	});

	it("scores a practical reduction against every tracked goal", () => {
		const proteinBase = {
			fdcId: 7,
			description: "Protein base",
			foodNutrients: [
				{
					nutrientId: NUTRIENT_IDS.CARBS,
					nutrientName: "Carbohydrate",
					nutrientNumber: "205",
					unitName: "G",
					value: 0,
				},
				{
					nutrientId: NUTRIENT_IDS.PROTEIN,
					nutrientName: "Protein",
					nutrientNumber: "203",
					unitName: "G",
					value: 20,
				},
			],
		} satisfies FdcFood;
		const carbSource = {
			fdcId: 8,
			description: "Carb source",
			foodNutrients: [
				{
					nutrientId: NUTRIENT_IDS.CARBS,
					nutrientName: "Carbohydrate",
					nutrientNumber: "205",
					unitName: "G",
					value: 40,
				},
				{
					nutrientId: NUTRIENT_IDS.PROTEIN,
					nutrientName: "Protein",
					nutrientNumber: "203",
					unitName: "G",
					value: 0,
				},
			],
      foodServings: [
        {
				label: "1 piece",
				gramWeight: 25,
				isPrimary: true,
				origin: "package-label",
				gramWeightMethod: "source-reported",
        },
      ],
		} satisfies FdcFood;

		const suggestions = getNutrientAdjustmentSuggestions({
			nutrients: [
				{ id: NUTRIENT_IDS.CARBS, label: "Total Carb.", unit: "g" },
				{ id: NUTRIENT_IDS.PROTEIN, label: "Protein", unit: "g" },
			],
			selectedFoods: [proteinBase, carbSource],
			nutrientGoals: {
        [NUTRIENT_IDS.CARBS]: exactGoal(NUTRIENT_IDS.CARBS, 30),
        [NUTRIENT_IDS.PROTEIN]: exactGoal(NUTRIENT_IDS.PROTEIN, 20, 2),
			},
			servingGrams: {
				[proteinBase.fdcId]: 100,
				[carbSource.fdcId]: 100,
			},
		});

		expect(suggestions[0]).toMatchObject({
			food: carbSource,
			direction: "decrease",
			changeGrams: 25,
			nextServingGrams: 75,
		});
		expect(suggestions[0].primaryImpact).toMatchObject({
			label: "Total Carb.",
			amountChange: -10,
			nextTotal: 30,
		});
	});

	it("hides an adjustment that would worsen another tracked goal", () => {
		const proteinBar = {
			fdcId: 30,
			description: "Protein bar",
			foodNutrients: [
				{
					nutrientId: NUTRIENT_IDS.CARBS,
					nutrientName: "Carbohydrate",
					nutrientNumber: "205",
					unitName: "G",
					value: 40,
				},
				{
					nutrientId: NUTRIENT_IDS.PROTEIN,
					nutrientName: "Protein",
					nutrientNumber: "203",
					unitName: "G",
					value: 20,
				},
			],
      foodServings: [
        {
				label: "1/4 bar",
				gramWeight: 25,
				isPrimary: true,
				origin: "package-label",
				gramWeightMethod: "source-reported",
        },
      ],
		} satisfies FdcFood;

		const suggestions = getNutrientAdjustmentSuggestions({
			nutrients: [
				{ id: NUTRIENT_IDS.CARBS, label: "Total Carb.", unit: "g" },
				{ id: NUTRIENT_IDS.PROTEIN, label: "Protein", unit: "g" },
			],
			selectedFoods: [proteinBar],
			nutrientGoals: {
        [NUTRIENT_IDS.CARBS]: exactGoal(NUTRIENT_IDS.CARBS, 30),
        [NUTRIENT_IDS.PROTEIN]: exactGoal(NUTRIENT_IDS.PROTEIN, 20, 2),
			},
			servingGrams: { [proteinBar.fdcId]: 100 },
		});

		expect(suggestions).toEqual([]);
	});

	it("requires complete tracked nutrient data", () => {
		const suggestions = getNutrientAdjustmentSuggestions({
			nutrients: [
				{ id: NUTRIENT_IDS.PROTEIN, label: "Protein", unit: "g" },
				{ id: NUTRIENT_IDS.FAT, label: "Total Fat", unit: "g" },
			],
			selectedFoods: [milk],
			nutrientGoals: {
        [NUTRIENT_IDS.PROTEIN]: exactGoal(NUTRIENT_IDS.PROTEIN, 6),
        [NUTRIENT_IDS.FAT]: exactGoal(NUTRIENT_IDS.FAT, 10, 2),
			},
			servingGrams: { [milk.fdcId]: 100 },
		});

		expect(suggestions).toEqual([]);
	});

	it("requires explicit nutrient-specific goals", () => {
		const suggestions = getNutrientAdjustmentSuggestions({
			nutrients: [{ id: 9999, label: "Unsupported nutrient", unit: "g" }],
			selectedFoods: [milk],
			nutrientGoals: {},
			servingGrams: { [milk.fdcId]: 100 },
		});

		expect(suggestions).toEqual([]);
	});

	it("suppresses suggestions when safety or source-quality evidence is blocked", () => {
		const conflictFood = {
			...milk,
			compatibilityEvaluation: {
				status: "conflict",
			} as FdcFood["compatibilityEvaluation"],
		} satisfies FdcFood;
		const sourceErrorFood = {
			...milk,
			fdcId: 31,
			sourceMetadata: { qualityErrorTags: ["invalid-nutrition"] },
		} satisfies FdcFood;
    const request = (food: FdcFood) =>
      getNutrientAdjustmentSuggestions({
			nutrients: [{ id: NUTRIENT_IDS.PROTEIN, label: "Protein", unit: "g" }],
			selectedFoods: [food],
        nutrientGoals: {
          [NUTRIENT_IDS.PROTEIN]: exactGoal(NUTRIENT_IDS.PROTEIN, 6),
        },
			servingGrams: { [food.fdcId]: 100 },
		});

		expect(request(conflictFood)).toEqual([]);
		expect(request(sourceErrorFood)).toEqual([]);
	});

	it("can adjust a safe food without recommending a conflicting ingredient", () => {
		const conflictFood = {
			...milk,
			compatibilityEvaluation: {
				status: "conflict",
			} as FdcFood["compatibilityEvaluation"],
		} satisfies FdcFood;
		const safeFood = {
			...milk,
			fdcId: 32,
			description: "Safe protein food",
		} satisfies FdcFood;

		const suggestions = getNutrientAdjustmentSuggestions({
			nutrients: [{ id: NUTRIENT_IDS.PROTEIN, label: "Protein", unit: "g" }],
			selectedFoods: [conflictFood, safeFood],
      nutrientGoals: {
        [NUTRIENT_IDS.PROTEIN]: exactGoal(NUTRIENT_IDS.PROTEIN, 10),
      },
			servingGrams: {
				[conflictFood.fdcId]: 100,
				[safeFood.fdcId]: 100,
			},
		});

		expect(suggestions).toHaveLength(1);
		expect(suggestions[0].food).toEqual(safeFood);
	});
});
