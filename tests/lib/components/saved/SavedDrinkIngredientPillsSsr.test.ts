// @vitest-environment node

import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import SavedDrinkIngredientPills from "$lib/components/saved/SavedDrinkIngredientPills/SavedDrinkIngredientPills.svelte";
import { configureAppReferenceCatalog } from "$lib/utils/food/reference/appReferenceCatalog";
import type { FdcFood } from "$lib/utils/food/types";

configureAppReferenceCatalog({
	nutrients: [],
	nutrientDisplayProfiles: [],
	nutrientEquivalences: [],
	mixGoalTemplates: [],
	mixRuntime: {
		defaultGoalByUnit: {},
		progressThresholds: {
			atGoal: 1,
			barelyOver: 1.1,
			midwayOver: 1.35,
		},
		pointGoalTolerance: 0.1,
		defaultServingGrams: 100,
	},
	foodSymbols: [
		{ key: "fruit", label: "Fruit", emoji: "🍓" },
		{ key: "generic", label: "Ingredient", emoji: "🥣" },
	],
	foodSymbolCategoryRules: [
		{
			symbolKey: "fruit",
			matchPattern: "(banana|mango|pineapple)",
			priority: 10,
		},
	],
});

const foods: FdcFood[] = [
	"Banana",
	"Spinach",
	"Greek Yogurt",
	"Chia Seeds",
	"Blueberries",
	"Almond Milk",
	"Flax Seeds",
	"Mango",
	"Pineapple",
	"Ginger",
].map((description, index) => ({
	fdcId: index + 1,
	description,
	foodNutrients: [],
}));

describe("SavedDrinkIngredientPills server rendering", () => {
	it("renders visible ingredients and overflow without a route error", () => {
		const { body } = render(SavedDrinkIngredientPills, {
			props: { foods },
		});

		expect(body).toContain("Banana");
		expect(body).toContain("Spinach");
		expect(body).toContain("+2 more");
		expect(body).toContain("Show fewer ingredients");
		expect(body).toContain("Pineapple");
		expect(body).toContain("Ginger");
		expect(body).toContain('data-span="5"');
	});
});
