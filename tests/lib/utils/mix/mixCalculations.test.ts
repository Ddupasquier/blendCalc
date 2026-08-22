import { afterEach, describe, expect, it } from "vitest";
import {
	getChartValues,
	getDefaultNutrientGoal,
	getGoalValues,
	getNutrientAdjustmentSuggestions,
	getNutrientChartMetrics,
	getNutrientContributionBreakdowns,
	getNutrientContributors,
	getNutrientProgress,
	getNutrientTotal,
} from "$lib/utils/mix/calculations";
import { configureAppReferenceCatalog } from "$lib/utils/food/reference/appReferenceCatalog";
import { resolveFoodNutrient } from "$lib/utils/food/nutrients/foodNutrients";
import { NUTRIENT_IDS, type FoodItem } from "$lib/utils/food/types";
import { appReferenceCatalogFixture } from "../../../fixtures/referenceCatalogs";

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
} satisfies FoodItem;

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
} satisfies FoodItem;

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

const directionalGoal = (
	nutrientId: number,
	targetAmount: number,
	goalType: "minimum" | "maximum",
	sortOrder: number,
) => ({
	...exactGoal(nutrientId, targetAmount, sortOrder),
	goalType,
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

	it("does not invent a nutrient target from another nutrient's unit", () => {
		expect(
			getDefaultNutrientGoal({ id: 1090, label: "Magnesium", unit: "mg" }),
		).toBeNull();
		expect(
			getNutrientChartMetrics(
				[{ id: 1090, label: "Magnesium", unit: "mg" }],
				[],
				{},
				{},
			),
		).toEqual([]);
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
		} satisfies FoodItem;

		expect(
			resolveFoodNutrient(zeroProteinFood, NUTRIENT_IDS.PROTEIN),
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
		expect(resolveFoodNutrient(milk, NUTRIENT_IDS.FAT)).toMatchObject({
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
		} satisfies FoodItem;
		const incompleteMacros = {
			...completeMacros,
			fdcId: 12,
			foodNutrients: completeMacros.foodNutrients.filter(
				(nutrient) => nutrient.nutrientId !== NUTRIENT_IDS.PROTEIN,
			),
		} satisfies FoodItem;

		expect(
			resolveFoodNutrient(completeMacros, NUTRIENT_IDS.CALORIES),
		).toMatchObject({
			value: null,
			source: "missing",
		});
		expect(
			resolveFoodNutrient(incompleteMacros, NUTRIENT_IDS.CALORIES),
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
		} satisfies FoodItem;
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
		} satisfies FoodItem;

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
		expect(getGoalValues(metrics)[0]).toBeCloseTo(1);
		expect(getGoalValues(metrics)[1]).toBeCloseTo(0.24);
		expect(getChartValues(metrics)[0]).toBeCloseTo(1);
		expect(getChartValues(metrics)[1]).toBeCloseTo(0.0799);
		expect(getChartValues(metrics)[0]).toBeGreaterThan(
			getChartValues(metrics)[1],
		);
	});

	it("makes the highest relative goal touch the boundary and lets actual amounts match the goal shape", () => {
		const nutrients = [
			{ id: NUTRIENT_IDS.CALORIES, label: "Calories", unit: "kcal" },
			{ id: NUTRIENT_IDS.PROTEIN, label: "Protein", unit: "g" },
			{ id: NUTRIENT_IDS.CARBS, label: "Carbohydrates", unit: "g" },
		];
		const goalMatchingFood = {
			fdcId: 5,
			description: "Goal-matching food",
			foodNutrients: [
				{
					nutrientId: NUTRIENT_IDS.CALORIES,
					nutrientName: "Energy",
					nutrientNumber: "208",
					unitName: "KCAL",
					value: 350,
				},
				{
					nutrientId: NUTRIENT_IDS.PROTEIN,
					nutrientName: "Protein",
					nutrientNumber: "203",
					unitName: "G",
					value: 20,
				},
				{
					nutrientId: NUTRIENT_IDS.CARBS,
					nutrientName: "Carbohydrate, by difference",
					nutrientNumber: "205",
					unitName: "G",
					value: 90,
				},
			],
		} satisfies FoodItem;
		const goals = {
			[NUTRIENT_IDS.CALORIES]: exactGoal(NUTRIENT_IDS.CALORIES, 350),
			[NUTRIENT_IDS.PROTEIN]: exactGoal(NUTRIENT_IDS.PROTEIN, 20, 2),
			[NUTRIENT_IDS.CARBS]: exactGoal(NUTRIENT_IDS.CARBS, 90, 3),
		};
		const metrics = getNutrientChartMetrics(
			nutrients,
			[goalMatchingFood],
			goals,
			{ [goalMatchingFood.fdcId]: 100 },
		);
		const halfwayMetrics = getNutrientChartMetrics(
			nutrients,
			[goalMatchingFood],
			goals,
			{ [goalMatchingFood.fdcId]: 50 },
		);

		expect(getGoalValues(metrics)).toEqual(getChartValues(metrics));
		expect(getGoalValues(metrics)[0]).toBeCloseTo(2 / 3);
		expect(getGoalValues(metrics)[1]).toBeCloseTo(8 / 15);
		expect(getGoalValues(metrics)[2]).toBe(1);
		expect(new Set(getGoalValues(metrics))).toHaveLength(3);
		expect(getGoalValues(halfwayMetrics)).toEqual(getGoalValues(metrics));
		getChartValues(halfwayMetrics).forEach((currentRadius, index) => {
			expect(currentRadius).toBeCloseTo(
				(getGoalValues(halfwayMetrics)[index] ?? 0) / 2,
			);
		});
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
		} satisfies FoodItem;
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
		} satisfies FoodItem;
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
		} satisfies FoodItem;
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
		} satisfies FoodItem;

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


	it("keeps ranking safe corrections after the display score reaches zero", () => {
		const suggestions = getNutrientAdjustmentSuggestions({
			nutrients: [{ id: NUTRIENT_IDS.PROTEIN, label: "Protein", unit: "g" }],
			selectedFoods: [milk],
			nutrientGoals: {
				[NUTRIENT_IDS.PROTEIN]: exactGoal(NUTRIENT_IDS.PROTEIN, 1),
			},
			servingGrams: { [milk.fdcId]: 3000 },
		});

		expect(suggestions[0]).toMatchObject({
			food: milk,
			direction: "decrease",
			currentServingGrams: 3000,
			nextServingGrams: 2900,
		});
	});

	it("keeps the representative five-goal food corpus selected-only, practical, and safe", () => {
		const nutrient = (
			nutrientId: number,
			nutrientName: string,
			value: number,
		) => ({
			nutrientId,
			nutrientName,
			nutrientNumber: String(nutrientId),
			unitName: nutrientId === NUTRIENT_IDS.CALORIES ? "KCAL" : "G",
			value,
		});
		const representativeFoods = [
			{
				fdcId: 40,
				description: "Spinach, Raw",
				foodNutrients: [
					nutrient(NUTRIENT_IDS.CALORIES, "Calories", 23),
					nutrient(NUTRIENT_IDS.PROTEIN, "Protein", 2.86),
					nutrient(NUTRIENT_IDS.FIBER, "Dietary Fiber", 2.2),
					nutrient(NUTRIENT_IDS.SUGAR, "Total Sugars", 0.42),
					nutrient(NUTRIENT_IDS.FAT, "Total Fat", 0.39),
				],
				foodServings: [
					{
						label: "1 cup",
						gramWeight: 30,
						isPrimary: true,
						origin: "source-household-measure",
						gramWeightMethod: "source-reported",
					},
				],
			},
			{
				fdcId: 41,
				description: "Banana, Raw",
				foodNutrients: [
					nutrient(NUTRIENT_IDS.CALORIES, "Calories", 89),
					nutrient(NUTRIENT_IDS.PROTEIN, "Protein", 1.09),
					nutrient(NUTRIENT_IDS.FIBER, "Dietary Fiber", 2.6),
					nutrient(NUTRIENT_IDS.SUGAR, "Total Sugars", 12.23),
					nutrient(NUTRIENT_IDS.FAT, "Total Fat", 0.33),
				],
				foodServings: [
					{
						label: "1 medium banana",
						gramWeight: 118,
						isPrimary: true,
						origin: "source-household-measure",
						gramWeightMethod: "source-reported",
					},
				],
			},
			{
				fdcId: 42,
				description: "Yogurt, Greek, Plain",
				foodNutrients: [
					nutrient(NUTRIENT_IDS.CALORIES, "Calories", 59),
					nutrient(NUTRIENT_IDS.PROTEIN, "Protein", 10.19),
					nutrient(NUTRIENT_IDS.FIBER, "Dietary Fiber", 0),
					nutrient(NUTRIENT_IDS.SUGAR, "Total Sugars", 3.6),
					nutrient(NUTRIENT_IDS.FAT, "Total Fat", 0.39),
				],
			},
			{
				fdcId: 43,
				description: "Chia Seeds, Dried",
				foodNutrients: [
					nutrient(NUTRIENT_IDS.CALORIES, "Calories", 486),
					nutrient(NUTRIENT_IDS.PROTEIN, "Protein", 16.54),
					nutrient(NUTRIENT_IDS.FIBER, "Dietary Fiber", 34.4),
					nutrient(NUTRIENT_IDS.SUGAR, "Total Sugars", 0),
					nutrient(NUTRIENT_IDS.FAT, "Total Fat", 30.74),
				],
				foodServings: [
					{
						label: "1 tablespoon",
						gramWeight: 17,
						isPrimary: true,
						origin: "source-household-measure",
						gramWeightMethod: "source-reported",
					},
				],
			},
		] satisfies FoodItem[];
		const nutrients = [
			{ id: NUTRIENT_IDS.CALORIES, label: "Calories", unit: "kcal" },
			{ id: NUTRIENT_IDS.PROTEIN, label: "Protein", unit: "g" },
			{ id: NUTRIENT_IDS.FIBER, label: "Dietary Fiber", unit: "g" },
			{ id: NUTRIENT_IDS.SUGAR, label: "Total Sugars", unit: "g" },
			{ id: NUTRIENT_IDS.FAT, label: "Total Fat", unit: "g" },
		];
		const nutrientGoals = {
			[NUTRIENT_IDS.CALORIES]: directionalGoal(
				NUTRIENT_IDS.CALORIES,
				320,
				"minimum",
				1,
			),
			[NUTRIENT_IDS.PROTEIN]: directionalGoal(
				NUTRIENT_IDS.PROTEIN,
				23,
				"minimum",
				2,
			),
			[NUTRIENT_IDS.FIBER]: directionalGoal(
				NUTRIENT_IDS.FIBER,
				12,
				"minimum",
				3,
			),
			[NUTRIENT_IDS.SUGAR]: directionalGoal(
				NUTRIENT_IDS.SUGAR,
				25,
				"maximum",
				4,
			),
			[NUTRIENT_IDS.FAT]: directionalGoal(
				NUTRIENT_IDS.FAT,
				10,
				"maximum",
				5,
			),
		};
		const servingGrams = { 40: 60, 41: 120, 42: 150, 43: 17 };
		const request = (selectedFoods: FoodItem[]) =>
			getNutrientAdjustmentSuggestions({
				nutrients,
				selectedFoods,
				nutrientGoals,
				servingGrams,
				maxSuggestions: 10,
			});

		const suggestions = request(representativeFoods);
		expect(suggestions).toHaveLength(1);
		expect(suggestions[0]).toMatchObject({
			food: representativeFoods[0],
			direction: "increase",
			changeGrams: 30,
			incrementLabel: "1 cup",
			incrementSource: "source-serving",
		});
		expect(new Set(suggestions.map(({ food }) => food.fdcId)).size).toBe(
			suggestions.length,
		);

		const conflictingYogurt = {
			...representativeFoods[2],
			compatibilityEvaluation: {
				status: "conflict",
			} as FoodItem["compatibilityEvaluation"],
		} satisfies FoodItem;
		const conflictSuggestions = request([
			representativeFoods[0],
			representativeFoods[1],
			conflictingYogurt,
			representativeFoods[3],
		]);
		expect(conflictSuggestions.map(({ food }) => food.fdcId)).toEqual([40]);

		const incompleteFood = {
			fdcId: 44,
			description: "Incomplete nutrition food",
			foodNutrients: [nutrient(NUTRIENT_IDS.CALORIES, "Calories", 100)],
		} satisfies FoodItem;
		expect(request([...representativeFoods, incompleteFood])).toEqual([]);
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
		} satisfies FoodItem;

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
			} as FoodItem["compatibilityEvaluation"],
		} satisfies FoodItem;
		const sourceErrorFood = {
			...milk,
			fdcId: 31,
			sourceMetadata: { qualityErrorTags: ["invalid-nutrition"] },
		} satisfies FoodItem;
		const request = (food: FoodItem) =>
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
			} as FoodItem["compatibilityEvaluation"],
		} satisfies FoodItem;
		const safeFood = {
			...milk,
			fdcId: 32,
			description: "Safe protein food",
		} satisfies FoodItem;

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
