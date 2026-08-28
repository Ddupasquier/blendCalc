import { describe, expect, it } from "vitest";
import type { FoodItem } from "$lib/utils/food/types";
import {
	filterFoodsBySafety,
	foodHasActiveRecall,
	foodHasNonRecallWarning,
} from "$lib/utils/food/safety/foodSafetyFilters";

const makeFood = (values: Partial<FoodItem>): FoodItem => ({
	fdcId: 1,
	description: "Test food",
	foodNutrients: [],
	...values,
});

const recallAlert = {
	id: "recall-1",
	providerKey: "open-fda-food-enforcement",
	sourceName: "openFDA Food Enforcement",
	sourceAttribution: "U.S. Food and Drug Administration",
	alertType: "recall" as const,
	status: "Ongoing",
	productDescription: "Recalled food",
	sourceUrl: "https://api.fda.gov/food/enforcement.json",
	matchType: "exact_gtin" as const,
	requiresPackageCheck: false,
	detectedAt: "2026-08-14T12:00:00.000Z",
};

describe("food safety filters", () => {
	it("separates active recalls from preference and public-health warnings", () => {
		const ordinaryFood = makeFood({ fdcId: 1, description: "Rice" });
		const preferenceWarningFood = makeFood({
			fdcId: 2,
			description: "Milk",
			preferenceWarnings: [
				{
					id: "milk-warning",
					level: "warning",
					category: "allergen",
					label: "Milk",
					code: "FOOD_ALLERGEN_CONTAINS",
					params: {},
				},
			],
		});
		const publicHealthWarningFood = makeFood({
			fdcId: 3,
			description: "Food under investigation",
			safetyAlerts: [
				{
					...recallAlert,
					id: "alert-1",
					alertType: "public_health_alert",
				},
			],
		});
		const recalledFood = makeFood({
			fdcId: 4,
			description: "Recalled food",
			safetyAlerts: [recallAlert],
		});
		const foods = [
			ordinaryFood,
			preferenceWarningFood,
			publicHealthWarningFood,
			recalledFood,
		];

		expect(foodHasNonRecallWarning(preferenceWarningFood)).toBe(true);
		expect(foodHasNonRecallWarning(publicHealthWarningFood)).toBe(true);
		expect(foodHasNonRecallWarning(recalledFood)).toBe(false);
		expect(foodHasActiveRecall(recalledFood)).toBe(true);
		expect(filterFoodsBySafety(foods, "warnings")).toEqual([
			preferenceWarningFood,
			publicHealthWarningFood,
		]);
		expect(filterFoodsBySafety(foods, "active-recalls")).toEqual([
			recalledFood,
		]);
		expect(filterFoodsBySafety(foods, "all")).toEqual(foods);
	});
});
