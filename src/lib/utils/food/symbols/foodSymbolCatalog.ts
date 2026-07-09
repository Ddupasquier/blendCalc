import type { FdcFood } from "$lib/utils/food/types";

export type FoodSymbolKey =
	| "proteinPowder"
	| "beverage"
	| "sweets"
	| "oilsFats"
	| "dairy"
	| "meat"
	| "seafood"
	| "grains"
	| "nutsSeeds"
	| "vegetables"
	| "fruit"
	| "packaged"
	| "generic";

export type FoodSymbolMatchInput = Pick<FdcFood, "description" | "foodCategory"> &
	Partial<Pick<FdcFood, "brandOwner" | "dataType" | "customFood">>;

export type FoodSymbolCatalogItem = {
	key: FoodSymbolKey;
	symbol: string;
	label: string;
	keywords: string[];
};

export const FOOD_SYMBOL_CATALOG: readonly FoodSymbolCatalogItem[] = [
	{
		key: "proteinPowder",
		symbol: "💪",
		label: "Protein powder",
		keywords: ["protein powder", "whey", "casein", "protein concentrate", "protein isolate"],
	},
	{
		key: "beverage",
		symbol: "🥤",
		label: "Beverage",
		keywords: ["beverage", "drink", "water", "juice", "soda", "coffee", "tea"],
	},
	{
		key: "sweets",
		symbol: "🍬",
		label: "Sweets",
		keywords: [
			"sweet",
			"sweets",
			"candy",
			"candies",
			"chocolate",
			"sugar",
			"syrup",
			"jelly",
			"jam",
			"dessert",
			"cookie",
			"cake",
		],
	},
	{
		key: "oilsFats",
		symbol: "🧈",
		label: "Oils and fats",
		keywords: ["oil", "oils", "fat", "fats", "butter", "margarine", "shortening"],
	},
	{
		key: "dairy",
		symbol: "🥛",
		label: "Dairy",
		keywords: ["dairy", "milk", "yogurt", "cheese", "cream", "egg"],
	},
	{
		key: "meat",
		symbol: "🥩",
		label: "Meat",
		keywords: ["meat", "beef", "pork", "chicken", "poultry", "turkey", "lamb", "sausage"],
	},
	{
		key: "seafood",
		symbol: "🐟",
		label: "Fish and seafood",
		keywords: ["fish", "seafood", "shellfish", "shrimp", "salmon", "tuna", "crab"],
	},
	{
		key: "grains",
		symbol: "🌾",
		label: "Grains",
		keywords: ["grain", "grains", "cereal", "wheat", "oat", "rice", "pasta", "bread", "flour"],
	},
	{
		key: "nutsSeeds",
		symbol: "🌰",
		label: "Nuts and seeds",
		keywords: ["nut", "nuts", "seed", "seeds", "almond", "peanut", "cashew", "chia", "walnut"],
	},
	{
		key: "vegetables",
		symbol: "🥬",
		label: "Vegetables",
		keywords: [
			"vegetable",
			"vegetables",
			"spinach",
			"kale",
			"broccoli",
			"tomato",
			"carrot",
			"lettuce",
		],
	},
	{
		key: "fruit",
		symbol: "🍓",
		label: "Fruit",
		keywords: [
			"fruit",
			"berries",
			"berry",
			"apple",
			"banana",
			"mango",
			"strawberry",
			"blueberry",
			"grape",
			"citrus",
			"peach",
			"pineapple",
			"melon",
			"kiwi",
		],
	},
	{
		key: "packaged",
		symbol: "📦",
		label: "Packaged food",
		keywords: ["branded", "packaged", "prepared", "sauce", "soup", "condiment"],
	},
	{
		key: "generic",
		symbol: "🥣",
		label: "Ingredient",
		keywords: [],
	},
];

const normalizeSymbolText = (value?: string | null) =>
	(value ?? "").trim().toLowerCase();

const foodSymbolText = (food: FoodSymbolMatchInput) =>
	[
		food.foodCategory,
		food.description,
		food.dataType,
		food.brandOwner ? "packaged" : "",
		food.customFood ? "custom" : "",
	]
		.map(normalizeSymbolText)
		.filter(Boolean)
		.join(" ");

const escapeRegExp = (value: string) =>
	value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const textMatchesKeyword = (text: string, keyword: string) =>
	new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword)}([^a-z0-9]|$)`).test(text);

export const getFoodSymbolCatalogItem = (food: FoodSymbolMatchInput) => {
	const text = foodSymbolText(food);
	return (
		FOOD_SYMBOL_CATALOG.find((item) =>
			item.keywords.some((keyword) => textMatchesKeyword(text, keyword)),
		) ?? FOOD_SYMBOL_CATALOG[FOOD_SYMBOL_CATALOG.length - 1]
	);
};
