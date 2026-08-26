import { describe, expect, it } from "vitest";
import type { FoodItem } from "$lib/utils/food/types";
import { rankIngredientSearchCandidates } from "$lib/utils/ingredients/ingredientSearchRelevance";

const food = (fdcId: number, description: string): FoodItem => ({
	fdcId,
	description,
	foodNutrients: [],
});

const foodWithMetadata = (
	fdcId: number,
	description: string,
	metadata: Partial<FoodItem>,
): FoodItem => ({ ...food(fdcId, description), ...metadata });

describe("ingredient search relevance", () => {
	it("puts first-word and first-three-word matches before late mentions", () => {
		const ranked = rankIngredientSearchCandidates(
			[
				food(4, "Babyfood, ravioli, cheese filled, with tomato sauce"),
				food(3, "CAMPBELL'S, Tomato Soup, condensed"),
				food(2, "Tomatoes, raw"),
				food(1, "Tomato, roma"),
			],
			"tomato",
		);

		expect(ranked.map(({ fdcId }) => fdcId)).toEqual([1, 2, 3, 4]);
	});

	it("uses the same ordering for unfinished words", () => {
		const candidates = [
			food(3, "Babyfood, dinner, macaroni and tomato"),
			food(4, "Green Tomato Pantry Preserve"),
			food(2, "Diced Tomatoes, Tomatoes"),
			food(1, "Tomato powder"),
		];
		const unfinishedWordOrder = rankIngredientSearchCandidates(
			candidates,
			"tomat",
		);
		const completedWordOrder = rankIngredientSearchCandidates(
			candidates,
			"tomato",
		);

		expect(unfinishedWordOrder.map(({ fdcId }) => fdcId)).toEqual([1, 2, 4, 3]);
		expect(completedWordOrder.map(({ fdcId }) => fdcId)).toEqual(
			unfinishedWordOrder.map(({ fdcId }) => fdcId),
		);
	});

	it("keeps bounded mid-word partial matches ahead of unrelated results", () => {
		const ranked = rankIngredientSearchCandidates(
			[food(2, "Plain crackers"), food(1, "Taylor Farms salad kit")],
			"aylor",
		);

		expect(ranked.map(({ fdcId }) => fdcId)).toEqual([1, 2]);
	});

	it("prioritizes multi-word matches concentrated near the name start", () => {
		const ranked = rankIngredientSearchCandidates(
			[
				food(3, "Babyfood dinner with tomato and green vegetables"),
				food(2, "Tomatoes, green, raw"),
				food(1, "Green tomatoes, raw"),
			],
			"green tomat",
		);

		expect(ranked.map(({ fdcId }) => fdcId)).toEqual([1, 2, 3]);
	});

	it("ranks product names before brands, organizations, and categories", () => {
		const ranked = rankIngredientSearchCandidates(
			[
				foodWithMetadata(4, "Garden Salad", {
					foodCategory: "Taylor Farms Produce",
				}),
				foodWithMetadata(3, "Marketside Iceberg Salad", {
					safetyAlerts: [
						{
							id: "alert-1",
							providerKey: "fda-food-enforcement",
							sourceName: "FDA",
							sourceAttribution: "FDA",
							alertType: "recall",
							status: "ongoing",
							productDescription: "Marketside iceberg lettuce",
							recallingOrganization: "Taylor Farms",
							sourceUrl: "https://www.fda.gov/example",
							matchType: "exact_gtin",
							requiresPackageCheck: true,
							detectedAt: "2026-08-14T12:00:00.000Z",
						},
					],
				}),
				foodWithMetadata(2, "Iceberg Salad", { brandOwner: "Taylor Farms" }),
				food(1, "Taylor Farms Salad Kit"),
			],
			"taylor farms",
		);

		expect(ranked.map(({ fdcId }) => fdcId)).toEqual([1, 2, 3, 4]);
	});

	it("keeps every matching brand product ahead of category-only matches", () => {
		const ranked = rankIngredientSearchCandidates(
			[
				foodWithMetadata(3, "Shredded Lettuce", {
					foodCategory: "Taylor Farms Produce",
				}),
				foodWithMetadata(2, "Iceberg Salad, 24 Ounce", {
					brandOwner: "Taylor Farms",
				}),
				foodWithMetadata(1, "Iceberg Salad, 12 Ounce", {
					brandOwner: "Taylor Farms",
				}),
			],
			"taylor farms",
		);

		expect(ranked.map(({ fdcId }) => fdcId)).toEqual([1, 2, 3]);
	});

	it("matches supporting identity metadata after names, brands, and categories", () => {
		const ranked = rankIngredientSearchCandidates(
			[
				foodWithMetadata(2, "Plain Crackers", {
					ingredients: "Whole wheat flour",
				}),
				foodWithMetadata(1, "Whole Wheat Bread", {}),
			],
			"whole wheat",
		);

		expect(ranked.map(({ fdcId }) => fdcId)).toEqual([1, 2]);
	});

	it.each([
		{
			label: "brand",
			query: "rookshir",
			metadata: { brandOwner: "Brookshire Grocery Company" },
		},
		{
			label: "category",
			query: "hellfis",
			metadata: { foodCategory: "Finfish and Shellfish Products" },
		},
		{
			label: "canonical source name",
			query: "riginal recip",
			metadata: { canonicalDescription: "Original Recipe Mustard" },
		},
		{
			label: "nested structured ingredient",
			query: "oy prote",
			metadata: {
				structuredIngredients: [
					{
						text: "Seasoning",
						ingredients: [{ text: "Soy protein isolate" }],
					},
				],
			},
		},
		{
			label: "ingredient analysis tag",
			query: "alm oi",
			metadata: {
				ingredientAnalysis: {
					ingredientTags: ["en:palm-oil"],
					analysisTags: [],
					derivedTraceTags: [],
				},
			},
		},
		{
			label: "precautionary statement",
			query: "hared equip",
			metadata: {
				precautionaryStatements: [
					{
						type: "shared_equipment" as const,
						text: "Made on shared equipment with peanuts",
						allergens: ["Peanuts"],
						sourceField: "traces",
					},
				],
			},
		},
		{
			label: "explicit allergen disclosure",
			query: "ontains mi",
			metadata: {
				allergenDisclosure: {
					contains: ["Contains milk"],
					mayContain: [],
				},
			},
		},
		{
			label: "serving label",
			query: "ablespo",
			metadata: {
				foodServings: [
					{
						label: "1 tablespoon",
						gramWeight: 16,
						isPrimary: true,
						measureType: "household measure",
					},
				],
			},
		},
		{
			label: "package description",
			query: "amily bott",
			metadata: {
				packageQuantity: { label: "Family bottle", amount: 32, unit: "fl oz" },
			},
		},
	])(
		"matches partial $label metadata without promoting unrelated foods",
		({ query, metadata }) => {
			const ranked = rankIngredientSearchCandidates(
				[
					food(2, "Unrelated food"),
					foodWithMetadata(1, "Matching food", metadata),
				],
				query,
			);

			expect(ranked.map(({ fdcId }) => fdcId)).toEqual([1, 2]);
		},
	);
});
