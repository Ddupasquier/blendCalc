import {
	buildFoodIngredientPresentation,
	buildFoodPreferenceWarningEvidence,
} from "$lib/server/food-safety/foodIngredientPresentation.server";
import type { FdcFood } from "$lib/utils/food/types";
import { describe, expect, it } from "vitest";

const createFood = (overrides: Partial<FdcFood> = {}): FdcFood => ({
	fdcId: 1,
	description: "Test food",
	foodNutrients: [],
	...overrides,
});

describe("food ingredient presentation", () => {
	it("preserves nested ingredients, explicit percentage bases, and source classifications", () => {
		const presentation = buildFoodIngredientPresentation(createFood({
			ingredients: "Sauce (tomatoes, olive oil), salt",
			structuredIngredients: [{
				text: "Sauce",
				percent: 80,
				ingredients: [
					{ text: "Tomatoes", percentEstimate: 65, vegan: "yes" },
					{ text: "Olive oil", percentMin: 10, percentMax: 15 },
				],
			}],
			ingredientAnalysis: {
				ingredientTags: ["en:tomatoes", "en:olive-oil"],
				analysisTags: ["en:vegan"],
				derivedTraceTags: ["en:possible-nuts"],
				percentAnalysis: 92.5,
				percentKnown: 80,
			},
			additives: ["en:e330"],
		}));

		expect(presentation).toMatchObject({
			ingredientText: "Sauce (tomatoes, olive oil), salt",
			rows: [
				{
					text: "Sauce",
					depth: 0,
					path: ["Sauce"],
					percentageLabel: "80%",
				},
				{
					text: "Tomatoes",
					depth: 1,
					path: ["Sauce", "Tomatoes"],
					percentageLabel: "About 65%",
					classifications: [{ label: "Vegan", value: "Yes" }],
				},
				{
					text: "Olive oil",
					depth: 1,
					percentageLabel: "10%–15%",
				},
			],
			metrics: [
				{ label: "Source analysis coverage", value: "92.5%" },
				{ label: "Known ingredient percentages", value: "80%" },
			],
			additives: ["E330"],
			hasSourceAnalysis: true,
		});
		expect(presentation?.tagGroups).toEqual([
			{ label: "Ingredient tags", values: ["Tomatoes", "Olive oil"] },
			{ label: "Source analysis", values: ["Vegan"] },
			{ label: "Source trace analysis", values: ["Possible nuts"] },
		]);
	});

	it("does not present invalid percentages as source evidence", () => {
		const presentation = buildFoodIngredientPresentation(createFood({
			structuredIngredients: [{ text: "Oats", percent: 140 }],
			ingredientAnalysis: {
				ingredientTags: [],
				analysisTags: [],
				derivedTraceTags: [],
				percentUnknown: -10,
			},
		}));

		expect(presentation?.rows[0]?.percentageLabel).toBeNull();
		expect(presentation?.metrics).toEqual([]);
	});

	it("links warning evidence to the exact structured ingredient path", () => {
		const presentation = buildFoodIngredientPresentation(createFood({
			structuredIngredients: [{
				text: "Seasoning",
				ingredients: [{ text: "Wheat", percent: 2 }],
			}],
		}));
		const evidence = buildFoodPreferenceWarningEvidence(
			{
				slug: "wheat",
				label: "Wheat",
				category: "allergen",
				factType: "ingredient_present",
				sourceType: "label_ingredient_field",
				sourceText: "Wheat",
				confidence: "confirmed",
			},
			3,
			presentation,
		);

		expect(evidence).toEqual({
			factType: "ingredient_present",
			sourceType: "label_ingredient_field",
			sourceText: "Wheat",
			confidence: "confirmed",
			policyVersion: 3,
			ingredientPath: ["Seasoning", "Wheat"],
			percentageLabel: "2%",
		});
	});
});
