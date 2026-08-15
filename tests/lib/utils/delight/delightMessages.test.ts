import { afterEach, describe, expect, it } from "vitest";

import {
	resolveDelightMessage,
	resolveFoodAddedDelightMessage,
	resolveMixDelightMessage,
} from "$lib/utils/delight/delightMessages";
import { createCustomFood } from "$lib/utils/food/custom/customFoods";
import { configureAppReferenceCatalog } from "$lib/utils/food/reference/appReferenceCatalog";
import { NUTRIENT_IDS } from "$lib/utils/food/types";
import type { SaveGoalDiff } from "$lib/utils/mix/ui/mixUi";
import { appReferenceCatalogFixture } from "../../../fixtures/referenceCatalogs";

const createGoalDifference = (
	nutrientId: number,
	status: SaveGoalDiff["status"],
	total = 10,
	goal = 10,
): SaveGoalDiff => ({
	nutrientId,
	label: String(nutrientId),
	unit: "g",
	total,
	goal,
	upperGoal: null,
	goalType: "exact",
	difference: total - goal,
	percentOfGoal: goal > 0 ? (total / goal) * 100 : 0,
	status,
});

const createFood = (description: string, fdcId: number) =>
	({
		...createCustomFood({
			name: description,
			servingWeightGrams: 100,
			nutrients: [],
		}),
		fdcId,
	});

describe("delight messages", () => {
	afterEach(() => configureAppReferenceCatalog(appReferenceCatalogFixture));

	it("selects one reviewed message by priority", () => {
		configureAppReferenceCatalog({
			...appReferenceCatalogFixture,
			delightMessages: [
				{
					key: "later",
					contextKey: "ingredients",
					triggerKey: "empty-list",
					matchKey: "fridge",
					message: "Later",
					minimumValue: null,
					maximumValue: null,
					priority: 200,
				},
				{
					key: "first",
					contextKey: "ingredients",
					triggerKey: "empty-list",
					matchKey: "fridge",
					message: "First",
					minimumValue: null,
					maximumValue: null,
					priority: 10,
				},
			],
		});

		expect(
			resolveDelightMessage([
				{
					contextKey: "ingredients",
					triggerKey: "empty-list",
					matchKeys: ["fridge"],
				},
			]),
		).toBe("First");
	});

	it("matches food puns through the reviewed food-symbol catalog", () => {
		const eggs = { ...createFood("Scrambled eggs", 1), symbolKey: "eggs" };

		expect(resolveFoodAddedDelightMessage(eggs)).toBe("Eggcellent choice.");
		expect(resolveFoodAddedDelightMessage(createFood("Plain oatmeal", 2))).toBeNull();
	});

	it("uses composition before goal or serving messages", () => {
		configureAppReferenceCatalog({
			...appReferenceCatalogFixture,
			foodSymbols: [
				...appReferenceCatalogFixture.foodSymbols,
				{ key: "water", label: "Water", emoji: "💧", familyKey: "beverage" },
			],
			foodSymbolResolutionRules: [
				{
					symbolKey: "water",
					matchPattern: "(^|[^a-z])water([^a-z]|$)",
					priority: 1,
					matchScopes: ["uncategorized_name"],
				},
				...appReferenceCatalogFixture.foodSymbolResolutionRules,
			],
			delightMessages: [
				...appReferenceCatalogFixture.delightMessages,
				{
					key: "mix-water-only",
					contextKey: "mix",
					triggerKey: "recipe-composition",
					matchKey: "water-only",
					message: "Premium artisanal hydration.",
					minimumValue: null,
					maximumValue: null,
					priority: 5,
				},
			],
		});
		const water = createFood("Mineral water", 3);

		expect(
			resolveMixDelightMessage({
				foods: [water],
				servingGrams: { [water.fdcId]: 600 },
				goalDifferences: [
					createGoalDifference(NUTRIENT_IDS.PROTEIN, "met"),
				],
				hasDangerWarning: false,
			}),
		).toBe("Premium artisanal hydration.");
	});

	it("shows goal encouragement only when every tracked goal is met", () => {
		const food = createFood("Balanced meal", 4);

		expect(
			resolveMixDelightMessage({
				foods: [food],
				servingGrams: { [food.fdcId]: 100 },
				goalDifferences: [
					createGoalDifference(NUTRIENT_IDS.PROTEIN, "met"),
					createGoalDifference(NUTRIENT_IDS.FIBER, "met"),
				],
				hasDangerWarning: false,
			}),
		).toBe("Achievement unlocked: numerically delicious.");
	});

	it("suppresses optional humor whenever a danger warning exists", () => {
		const eggs = { ...createFood("Eggs", 5), symbolKey: "eggs" };

		expect(
			resolveMixDelightMessage({
				foods: [eggs],
				servingGrams: { [eggs.fdcId]: 100 },
				goalDifferences: [
					createGoalDifference(NUTRIENT_IDS.PROTEIN, "met"),
				],
				hasDangerWarning: true,
			}),
		).toBeNull();
	});
});
