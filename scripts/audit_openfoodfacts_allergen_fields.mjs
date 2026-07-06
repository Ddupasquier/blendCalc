// Audit Open Food Facts search coverage for allergen/dietary metadata.
// Usage:
//   node scripts/audit_openfoodfacts_allergen_fields.mjs
//   node scripts/audit_openfoodfacts_allergen_fields.mjs "whole milk" "peanut butter"

import fetch from "node-fetch";

const BASE_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const DEFAULT_QUERIES = [
	"whole milk",
	"peanut butter",
	"wheat bread",
	"tofu",
	"shrimp",
];

const queries = process.argv.slice(2);
const auditQueries = queries.length > 0 ? queries : DEFAULT_QUERIES;

const FIELDS = [
	"product_name",
	"brands",
	"ingredients_text",
	"ingredients_text_en",
	"allergens",
	"allergens_tags",
	"traces",
	"traces_tags",
	"labels",
	"labels_tags",
	"categories",
	"categories_tags",
].join(",");

const buildSearchUrl = (query) => {
	const url = new URL(BASE_URL);
	url.searchParams.set("search_terms", query);
	url.searchParams.set("search_simple", "1");
	url.searchParams.set("action", "process");
	url.searchParams.set("json", "1");
	url.searchParams.set("page_size", "1");
	url.searchParams.set("fields", FIELDS);
	return url;
};

const searchTopProduct = async (query) => {
	const response = await fetch(buildSearchUrl(query), {
		headers: {
			accept: "application/json",
			"user-agent": "blendCalc/1.0 (audit script)",
		},
	});
	if (!response.ok) {
		throw new Error(
			`Open Food Facts search failed for "${query}": ${response.status} ${response.statusText}`,
		);
	}

	const data = await response.json();
	return data.products?.[0] ?? null;
};

const cleanTag = (value) =>
	String(value ?? "")
		.replace(/^[a-z]{2}:/i, "")
		.replace(/-/g, " ")
		.trim();

const uniqueValues = (values) => {
	const seen = new Set();
	return values.flatMap((value) => {
		const cleaned = cleanTag(value);
		const key = cleaned.toLowerCase();
		if (!cleaned || seen.has(key)) return [];
		seen.add(key);
		return [cleaned];
	});
};

const splitDelimitedValues = (value) => uniqueValues(String(value ?? "").split(/[;,]/));

const summarizeProduct = (query, product) => {
	if (!product) {
		return {
			query,
			matched: "No result",
			brandOwner: "—",
			allergensCount: 0,
			tracesCount: 0,
			dietaryTagsCount: 0,
			ingredientsText: "missing",
		};
	}

	const allergens = uniqueValues([
		...splitDelimitedValues(product.allergens),
		...(product.allergens_tags ?? []),
	]);
	const traces = uniqueValues([
		...splitDelimitedValues(product.traces),
		...(product.traces_tags ?? []),
	]);
	const dietaryTags = uniqueValues(product.labels_tags ?? []);

	return {
		query,
		matched: product.product_name ?? "Unnamed product",
		brandOwner: product.brands ?? "—",
		allergensCount: allergens.length,
		tracesCount: traces.length,
		dietaryTagsCount: dietaryTags.length,
		ingredientsText:
			product.ingredients_text_en || product.ingredients_text ? "present" : "missing",
		allergens,
		traces,
		dietaryTags,
	};
};

const results = [];
for (const query of auditQueries) {
	const product = await searchTopProduct(query);
	results.push(summarizeProduct(query, product));
}

console.table(
	results.map((result) => ({
		query: result.query,
		matched: result.matched,
		brandOwner: result.brandOwner,
		allergens: result.allergensCount,
		traces: result.tracesCount,
		dietaryTags: result.dietaryTagsCount,
		ingredientsText: result.ingredientsText,
	})),
);

for (const result of results) {
	console.log(`\n=== ${result.query} ===`);
	console.log(JSON.stringify(result, null, 2));
}
