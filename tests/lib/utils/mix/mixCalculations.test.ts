import { describe, expect, it } from "vitest";
import {
	getChartValues,
	getGoalValues,
	getNutrientChartMetrics,
	getNutrientContributionBreakdowns,
	getNutrientContributors,
	getNutrientFoodSuggestions,
	getNutrientProgress,
	getNutrientReductionSuggestions,
	getNutrientTotal,
} from "$lib/utils/mix/calculations";
import { NUTRIENT_IDS, type FdcFood } from "$lib/utils/food/types";

const sunflowerOil = {
	fdcId: 1,
	description: "Sunflower oil",
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

describe("mix calculations", () => {
	it("uses fallback nutrient mappings for totals", () => {
		expect(
			getNutrientTotal([sunflowerOil], NUTRIENT_IDS.FAT, {
				1: 50,
			}),
		).toBeCloseTo(46.6);
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
			[NUTRIENT_IDS.FAT]: 25,
			[NUTRIENT_IDS.PROTEIN]: 10,
		};

		const progress = getNutrientProgress(
			nutrients,
			foods,
			goals,
			servingGrams,
		);
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

	it("suggests unselected foods that help under-target nutrients", () => {
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
		const banana = {
			fdcId: 6,
			description: "Banana",
			foodNutrients: [
				{
					nutrientId: NUTRIENT_IDS.PROTEIN,
					nutrientName: "Protein",
					nutrientNumber: "203",
					unitName: "G",
					value: 1.1,
				},
			],
		} satisfies FdcFood;

		const suggestions = getNutrientFoodSuggestions({
			nutrients: [{ id: NUTRIENT_IDS.PROTEIN, label: "Protein", unit: "g" }],
			availableFoods: [milk, greekYogurt, banana],
			selectedFoodIds: [milk.fdcId],
			nutrientGoals: { [NUTRIENT_IDS.PROTEIN]: 25 },
			servingGrams: { [milk.fdcId]: 100 },
			sourceLabelForFood: () => "Fridge",
		});

		expect(suggestions[0]).toMatchObject({
			food: greekYogurt,
			action: "add",
			nutrientLabel: "Protein",
			amountPer100g: 10,
			targetAddedAmount: 21.67,
			sourceLabel: "Fridge",
		});
		expect(suggestions[0].servingGramsToTarget).toBeCloseTo(216.7);
		expect(suggestions.find((suggestion) => suggestion.food.fdcId === milk.fdcId))
			.toMatchObject({
				action: "increase",
				currentServingGrams: 100,
			});
	});

	it("flags suggestions that would worsen another nutrient goal", () => {
		const currentMix = {
			fdcId: 7,
			description: "Current mix",
			foodNutrients: [
				{
					nutrientId: NUTRIENT_IDS.CARBS,
					nutrientName: "Carbohydrate",
					nutrientNumber: "205",
					unitName: "G",
					value: 58,
				},
				{
					nutrientId: NUTRIENT_IDS.SUGAR,
					nutrientName: "Total Sugars",
					nutrientNumber: "269",
					unitName: "G",
					value: 21,
				},
			],
		} satisfies FdcFood;
		const sugar = {
			fdcId: 8,
			description: "Granulated sugar",
			foodNutrients: [
				{
					nutrientId: NUTRIENT_IDS.CARBS,
					nutrientName: "Carbohydrate",
					nutrientNumber: "205",
					unitName: "G",
					value: 99.8,
				},
				{
					nutrientId: NUTRIENT_IDS.SUGAR,
					nutrientName: "Total Sugars",
					nutrientNumber: "269",
					unitName: "G",
					value: 99.8,
				},
			],
		} satisfies FdcFood;

		const suggestions = getNutrientFoodSuggestions({
			nutrients: [
				{ id: NUTRIENT_IDS.CARBS, label: "Total Carb.", unit: "g" },
				{ id: NUTRIENT_IDS.SUGAR, label: "Total Sugars", unit: "g" },
			],
			availableFoods: [currentMix, sugar],
			selectedFoodIds: [currentMix.fdcId],
			nutrientGoals: {
				[NUTRIENT_IDS.CARBS]: 50,
				[NUTRIENT_IDS.SUGAR]: 25,
			},
			servingGrams: { [currentMix.fdcId]: 100 },
			sourceLabelForFood: () => "Fridge",
		});

		const sugarSuggestion = suggestions.find(
			(suggestion) => suggestion.food.fdcId === sugar.fdcId,
		);

		expect(sugarSuggestion).toBeDefined();
		expect(sugarSuggestion).toMatchObject({
			food: sugar,
			action: "add",
			nutrientLabel: "Total Sugars",
			targetAddedAmount: 4,
		});
		expect(sugarSuggestion?.servingGramsToTarget).toBeCloseTo(4.01);
		expect(sugarSuggestion?.conflicts[0]).toMatchObject({
			label: "Total Carb.",
			reason: "already-over",
		});
		expect(
			suggestions.find((suggestion) => suggestion.food.fdcId === currentMix.fdcId),
		).toMatchObject({
			action: "increase",
		});
	});

	it("shows one best suggestion per ingredient", () => {
		const egg = {
			fdcId: 9,
			description: "Egg, duck, whole",
			foodNutrients: [
				{
					nutrientId: NUTRIENT_IDS.CALORIES,
					nutrientName: "Energy",
					nutrientNumber: "208",
					unitName: "KCAL",
					value: 185,
				},
				{
					nutrientId: NUTRIENT_IDS.PROTEIN,
					nutrientName: "Protein",
					nutrientNumber: "203",
					unitName: "G",
					value: 12.8,
				},
				{
					nutrientId: NUTRIENT_IDS.FAT,
					nutrientName: "Total lipid",
					nutrientNumber: "204",
					unitName: "G",
					value: 13.8,
				},
			],
		} satisfies FdcFood;

		const suggestions = getNutrientFoodSuggestions({
			nutrients: [
				{ id: NUTRIENT_IDS.CALORIES, label: "Calories", unit: "kcal" },
				{ id: NUTRIENT_IDS.PROTEIN, label: "Protein", unit: "g" },
				{ id: NUTRIENT_IDS.FAT, label: "Total Fat", unit: "g" },
			],
			availableFoods: [egg],
			selectedFoodIds: [],
			nutrientGoals: {
				[NUTRIENT_IDS.CALORIES]: 500,
				[NUTRIENT_IDS.PROTEIN]: 30,
				[NUTRIENT_IDS.FAT]: 20,
			},
			servingGrams: {},
			sourceLabelForFood: () => "Fridge",
			maxSuggestions: 6,
		});

		expect(suggestions).toHaveLength(1);
		expect(suggestions[0]).toMatchObject({
			food: egg,
			nutrientLabel: "Total Fat",
		});
	});

	it("limits suggestions to three best next moves by default", () => {
		const foods = [0, 1, 2, 3].map(
			(index) =>
				({
					fdcId: 20 + index,
					description: `Protein food ${index}`,
					foodNutrients: [
						{
							nutrientId: NUTRIENT_IDS.PROTEIN,
							nutrientName: "Protein",
							nutrientNumber: "203",
							unitName: "G",
							value: 5 + index,
						},
					],
				}) satisfies FdcFood,
		);

		const suggestions = getNutrientFoodSuggestions({
			nutrients: [{ id: NUTRIENT_IDS.PROTEIN, label: "Protein", unit: "g" }],
			availableFoods: foods,
			selectedFoodIds: [],
			nutrientGoals: { [NUTRIENT_IDS.PROTEIN]: 50 },
			servingGrams: {},
			sourceLabelForFood: () => "Fridge",
		});

		expect(suggestions).toHaveLength(3);
		expect(new Set(suggestions.map((suggestion) => suggestion.food.fdcId)).size).toBe(
			3,
		);
	});

	it("suggests increasing selected foods for under-target nutrients", () => {
		const suggestions = getNutrientFoodSuggestions({
			nutrients: [{ id: NUTRIENT_IDS.PROTEIN, label: "Protein", unit: "g" }],
			availableFoods: [milk],
			selectedFoodIds: [milk.fdcId],
			nutrientGoals: { [NUTRIENT_IDS.PROTEIN]: 6 },
			servingGrams: { [milk.fdcId]: 100 },
			sourceLabelForFood: () => "Fridge",
		});

		expect(suggestions).toHaveLength(1);
		expect(suggestions[0]).toMatchObject({
			food: milk,
			action: "increase",
			currentServingGrams: 100,
		});
		expect(suggestions[0].servingGramsToTarget).toBeCloseTo(80.18);
		expect(suggestions[0].nextServingGrams).toBeCloseTo(180.18);
	});

	it("suggests reducing selected foods that put nutrients over goal", () => {
		const suggestions = getNutrientReductionSuggestions({
			nutrients: [{ id: NUTRIENT_IDS.FAT, label: "Total Fat", unit: "g" }],
			selectedFoods: [sunflowerOil],
			nutrientGoals: { [NUTRIENT_IDS.FAT]: 25 },
			servingGrams: { [sunflowerOil.fdcId]: 50 },
			sourceLabelForFood: () => "Fridge",
		});

		expect(suggestions).toHaveLength(1);
		expect(suggestions[0]).toMatchObject({
			food: sunflowerOil,
			nutrientLabel: "Total Fat",
			targetReducedAmount: 21.6,
			sourceLabel: "Fridge",
		});
		expect(suggestions[0].reduceByGrams).toBeCloseTo(23.18);
		expect(suggestions[0].nextServingGrams).toBeCloseTo(26.82);
	});

	it("warns when a reduction may drop another nutrient below goal", () => {
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
		} satisfies FdcFood;

		const suggestions = getNutrientReductionSuggestions({
			nutrients: [
				{ id: NUTRIENT_IDS.CARBS, label: "Total Carb.", unit: "g" },
				{ id: NUTRIENT_IDS.PROTEIN, label: "Protein", unit: "g" },
			],
			selectedFoods: [proteinBar],
			nutrientGoals: {
				[NUTRIENT_IDS.CARBS]: 30,
				[NUTRIENT_IDS.PROTEIN]: 20,
			},
			servingGrams: { [proteinBar.fdcId]: 100 },
			sourceLabelForFood: () => "Fridge",
		});

		expect(suggestions[0]).toMatchObject({
			food: proteinBar,
			nutrientLabel: "Total Carb.",
			targetReducedAmount: 10,
		});
		expect(suggestions[0].reduceByGrams).toBeCloseTo(25);
		expect(suggestions[0].conflicts[0]).toMatchObject({
			label: "Protein",
			reason: "would-drop-below",
		});
	});
});
