import { describe, expect, it } from "vitest";
import {
	getFoodSymbolCatalogItem,
	type FoodSymbolMatchInput,
} from "$lib/utils/food/symbols/foodSymbolCatalog";

const symbolKeyFor = (food: FoodSymbolMatchInput) =>
	getFoodSymbolCatalogItem(food).key;

describe("food symbol catalog", () => {
	it.each([
		{
			food: { description: "Spinach, raw", foodCategory: "Vegetables and Vegetable Products" },
			key: "vegetables",
		},
		{
			food: { description: "Strawberry jelly", foodCategory: "Jams" },
			key: "sweets",
		},
		{
			food: { description: "Oil, babassu", foodCategory: "Fats and Oils" },
			key: "oilsFats",
		},
		{
			food: { description: "Whey protein concentrate", foodCategory: "Protein" },
			key: "proteinPowder",
		},
		{
			food: { description: "Milk, evaporated", foodCategory: "Dairy and Egg Products" },
			key: "dairy",
		},
		{
			food: { description: "Chicken feet, boiled", foodCategory: "Poultry Products" },
			key: "meat",
		},
		{
			food: { description: "Crustaceans, shrimp", foodCategory: "Finfish and Shellfish Products" },
			key: "seafood",
		},
		{
			food: { description: "Rice flour", foodCategory: "Cereal Grains and Pasta" },
			key: "grains",
		},
		{
			food: { description: "Chia seeds, dried", foodCategory: "Seeds and Nuts" },
			key: "nutsSeeds",
		},
		{
			food: { description: "Apple juice", foodCategory: "Fruits and Fruit Juices" },
			key: "beverage",
		},
		{
			food: { description: "Mango, raw", foodCategory: "Fruit" },
			key: "fruit",
		},
		{
			food: { description: "Plain packaged food", foodCategory: "", brandOwner: "Example Brand" },
			key: "packaged",
		},
	])("matches $key fallback symbols", ({ food, key }) => {
		expect(symbolKeyFor(food)).toBe(key);
	});

	it("uses a generic symbol when no known food group matches", () => {
		expect(symbolKeyFor({ description: "Unknown item", foodCategory: "" })).toBe(
			"generic",
		);
	});
});
