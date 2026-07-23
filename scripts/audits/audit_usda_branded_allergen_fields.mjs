/**
 * Purpose: Search USDA FoodData Central branded foods and report whether their detail
 * records expose ingredients, allergens, dietary tags, and structured ingredient lists.
 * This read-only audit requires a FoodData Central API key and does not write to Supabase.
 * Run: `npm run audit:usda-branded-allergens`
 * Custom queries: `npm run audit:usda-branded-allergens -- "whole milk" "peanut butter"`
 */

import { config } from "dotenv";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../.env") });

const API_KEY = process.env.VITE_FDC_API_KEY;
const BASE_URL = "https://api.nal.usda.gov/fdc/v1";
const DEFAULT_QUERIES = [
	"whole milk",
	"peanut butter",
	"wheat bread",
	"tofu",
	"shrimp",
];

if (!API_KEY || API_KEY === "your_api_key_here") {
	console.error("Missing API key. Set VITE_FDC_API_KEY in your .env file.");
	process.exit(1);
}

const queries = process.argv.slice(2);
const auditQueries = queries.length > 0 ? queries : DEFAULT_QUERIES;

const buildSearchUrl = (query) => {
	const url = new URL(`${BASE_URL}/foods/search`);
	url.searchParams.set("api_key", API_KEY);
	url.searchParams.set("query", query);
	url.searchParams.set("pageSize", "5");
	url.searchParams.set("dataType", "Branded");
	return url;
};

const buildDetailUrl = (fdcId) => {
	const url = new URL(`${BASE_URL}/food/${fdcId}`);
	url.searchParams.set("api_key", API_KEY);
	return url;
};

const searchTopBrandedFood = async (query) => {
	const response = await fetch(buildSearchUrl(query));
	if (!response.ok) {
		throw new Error(
			`USDA branded search failed for "${query}": ${response.status} ${response.statusText}`,
		);
	}

	const data = await response.json();
	return data.foods?.[0] ?? null;
};

const fetchFoodDetail = async (fdcId) => {
	const response = await fetch(buildDetailUrl(fdcId));
	if (!response.ok) {
		throw new Error(
			`USDA food detail failed for ${fdcId}: ${response.status} ${response.statusText}`,
		);
	}

	return await response.json();
};

const summarizeFood = (query, food) => {
	if (!food) {
		return {
			query,
			matched: "No branded result",
			brandOwner: "—",
			allergensCount: 0,
			dietaryTagsCount: 0,
			ingredientListCount: 0,
			ingredientsText: "missing",
		};
	}

	return {
		query,
		matched: food.description,
		brandOwner: food.brandOwner ?? "—",
		allergensCount: food.allergens?.length ?? 0,
		dietaryTagsCount: food.dietaryTags?.length ?? 0,
		ingredientListCount: food.ingredientList?.length ?? 0,
		ingredientsText: food.ingredients ? "present" : "missing",
		allergens: food.allergens ?? [],
		dietaryTags: food.dietaryTags ?? [],
		ingredients: food.ingredients ?? null,
	};
};

const results = [];
for (const query of auditQueries) {
	const topResult = await searchTopBrandedFood(query);
	const detail = topResult ? await fetchFoodDetail(topResult.fdcId) : null;
	results.push(summarizeFood(query, detail));
}

console.table(
	results.map((result) => ({
		query: result.query,
		matched: result.matched,
		brandOwner: result.brandOwner,
		allergens: result.allergensCount,
		dietaryTags: result.dietaryTagsCount,
		ingredientList: result.ingredientListCount,
		ingredientsText: result.ingredientsText,
	})),
);

for (const result of results) {
	console.log(`\n=== ${result.query} ===`);
	console.log(JSON.stringify(result, null, 2));
}
