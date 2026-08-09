import { describe, expect, it } from "vitest";
import type { FoodItem } from "$lib/utils/food/types";
import { rankIngredientSearchCandidates } from "$lib/utils/ingredients/ingredientSearchRelevance";

const food = (fdcId: number, description: string): FoodItem => ({
	fdcId,
	description,
	foodNutrients: [],
});

describe("ingredient search relevance", () => {
	it("puts first-word and first-three-word matches before late mentions", () => {
		const ranked = rankIngredientSearchCandidates([
			food(4, "Babyfood, ravioli, cheese filled, with tomato sauce"),
			food(3, "CAMPBELL'S, Tomato Soup, condensed"),
			food(2, "Tomatoes, raw"),
			food(1, "Tomato, roma"),
		], "tomato");

		expect(ranked.map(({ fdcId }) => fdcId)).toEqual([1, 2, 3, 4]);
	});

	it("uses the same ordering for unfinished words", () => {
		const ranked = rankIngredientSearchCandidates([
			food(3, "Babyfood, dinner, macaroni and tomato"),
			food(2, "CAMPBELL'S, Tomato Soup, condensed"),
			food(1, "Tomato powder"),
		], "tomat");

		expect(ranked.map(({ fdcId }) => fdcId)).toEqual([1, 2, 3]);
	});

	it("prioritizes multi-word matches concentrated near the name start", () => {
		const ranked = rankIngredientSearchCandidates([
			food(3, "Babyfood dinner with tomato and green vegetables"),
			food(2, "Tomatoes, green, raw"),
			food(1, "Green tomatoes, raw"),
		], "green tomat");

		expect(ranked.map(({ fdcId }) => fdcId)).toEqual([1, 2, 3]);
	});
});
