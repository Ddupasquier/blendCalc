// @vitest-environment node

import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import FoodSymbol from "$lib/assets/icons/FoodSymbol/FoodSymbol.svelte";
import { configureAppReferenceCatalog } from "$lib/utils/food/reference/appReferenceCatalog";

configureAppReferenceCatalog({
	nutrients: [],
	nutrientDisplayProfiles: [],
	nutrientEquivalences: [],
	mixGoalTemplates: [],
	mixRuntime: {
		progressThresholds: { atGoal: 1, barelyOver: 1.1, midwayOver: 1.35 },
		pointGoalTolerance: 0.1,
		defaultServingGrams: 100,
	},
	foodSymbols: [
		{ key: "poop", label: "Poop", emoji: "💩" },
		{ key: "beer", label: "Beer", emoji: "🍺" },
		{ key: "mushrooms", label: "Mushrooms", emoji: "🍄" },
		{ key: "generic", label: "Ingredient", emoji: "🥣" },
	],
	foodSymbolCategoryRules: [
		{
			symbolKey: "poop",
			matchPattern:
				"(^|[^a-z])(poop|poo|shit|caca|feces|faeces|excrement|turd|dung|manure|crap)([^a-z]|$)",
			priority: 1,
		},
		{
			symbolKey: "beer",
			matchPattern: "(^|[^a-z])(beer|lager|stout)([^a-z]|$)",
			priority: 10,
		},
		{
			symbolKey: "mushrooms",
			matchPattern: "(^|[^a-z])(mushroom|shiitake)([^a-z]|$)",
			priority: 20,
		},
	],
});

const renderFallbackSymbol = (description: string) =>
	render(FoodSymbol, {
		props: {
			food: { description },
			fallbackOnly: true,
		},
	}).body;

describe("FoodSymbol server rendering", () => {
	it("renders specific database-catalog fallbacks with useful accessible names", () => {
		expect(renderFallbackSymbol("Craft lager beer")).toContain("🍺");
		expect(renderFallbackSymbol("Craft lager beer")).toContain(
			'aria-label="Beer"',
		);
		expect(renderFallbackSymbol("Shiitake mushrooms")).toContain("🍄");
	});

	it("renders the playful whole-word fallback without swallowing similar food names", () => {
		expect(renderFallbackSymbol("caca")).toContain("💩");
		expect(renderFallbackSymbol("Shiitake mushrooms")).not.toContain("💩");
	});
});
