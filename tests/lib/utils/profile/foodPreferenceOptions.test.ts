import { describe, expect, it } from "vitest";
import { getFoodPreferenceOptionSets } from "$lib/utils/profile/foodPreferenceOptions";

describe("food preference option sets", () => {
	it("groups catalog rows by profile category", () => {
		const options = getFoodPreferenceOptionSets([
			{
				category: "allergen",
				label: "Dairy",
				normalized_value: "dairy",
				source_values: ["milk"],
				tag_id: "tag-1",
				usage_count: 12,
			},
			{
				category: "dietary",
				label: "Vegan",
				normalized_value: "vegan",
				source_values: ["en:vegan"],
				tag_id: "tag-2",
				usage_count: 8,
			},
			{
				category: "ingredient",
				label: "Banana",
				normalized_value: "banana",
				source_values: ["banana"],
				tag_id: null,
				usage_count: 20,
			},
		]);

		expect(options.allergens.map((option) => option.label)).toEqual(["Dairy"]);
		expect(options.dietaryRestrictions.map((option) => option.label)).toEqual([
			"Vegan",
		]);
		expect(options.ingredients.map((option) => option.label)).toEqual(["Banana"]);
	});

	it("orders allergens and restrictions by DB usage count instead of a code vocabulary", () => {
		const options = getFoodPreferenceOptionSets([
			{
				category: "allergen",
				label: "Sesame",
				normalized_value: "sesame",
				source_values: ["sesame"],
				tag_id: "tag-sesame",
				usage_count: 100,
			},
			{
				category: "allergen",
				label: "Peanut",
				normalized_value: "peanut",
				source_values: ["peanut"],
				tag_id: "tag-peanut",
				usage_count: 5,
			},
			{
				category: "dietary",
				label: "Kosher",
				normalized_value: "kosher",
				source_values: ["kosher"],
				tag_id: "tag-kosher",
				usage_count: 40,
			},
			{
				category: "dietary",
				label: "Vegan",
				normalized_value: "vegan",
				source_values: ["vegan"],
				tag_id: "tag-vegan",
				usage_count: 2,
			},
		]);

		expect(options.allergens.map((option) => option.label)).toEqual([
			"Sesame",
			"Peanut",
		]);
		expect(options.dietaryRestrictions.map((option) => option.label)).toEqual([
			"Kosher",
			"Vegan",
		]);
	});

	it("orders ingredients by usage count, then label", () => {
		const options = getFoodPreferenceOptionSets([
			{
				category: "ingredient",
				label: "Mint",
				normalized_value: "mint",
				source_values: ["mint"],
				tag_id: null,
				usage_count: 3,
			},
			{
				category: "ingredient",
				label: "Banana",
				normalized_value: "banana",
				source_values: ["banana"],
				tag_id: null,
				usage_count: 12,
			},
			{
				category: "ingredient",
				label: "Apple",
				normalized_value: "apple",
				source_values: ["apple"],
				tag_id: null,
				usage_count: 12,
			},
		]);

		expect(options.ingredients.map((option) => option.label)).toEqual([
			"Apple",
			"Banana",
			"Mint",
		]);
	});

	it("returns empty option groups when the DB catalog is empty", () => {
		const options = getFoodPreferenceOptionSets([]);

		expect(options.allergens).toEqual([]);
		expect(options.dietaryRestrictions).toEqual([]);
		expect(options.ingredients).toEqual([]);
	});

	it("does not hide reviewed allergen options as the database catalog grows", () => {
		const records = Array.from({ length: 30 }, (_, index) => ({
			category: "allergen" as const,
			label: `Allergen ${index + 1}`,
			normalized_value: `allergen-${index + 1}`,
			source_values: [`allergen-${index + 1}`],
			tag_id: `tag-${index + 1}`,
			usage_count: 30 - index,
		}));

		expect(getFoodPreferenceOptionSets(records).allergens).toHaveLength(30);
	});
});
